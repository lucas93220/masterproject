jest.mock('../services/visualSearchTrial', () => ({ searchVisualMatches: jest.fn() }));
jest.mock('../services/prepareVisualSearchImage', () => ({ prepareVisualSearchBuffer: jest.fn() }));
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('../models/sousCategorie', () => ({ findAll: jest.fn() }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn(async id => ({ id_utilisateur: id, role: 'user' })) }));
jest.mock('../config/db', () => { throw new Error('Aucune base réelle dans ce test'); });

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const SousCategorie = require('../models/sousCategorie');
const { MAX_IMAGE_BYTES } = require('../middlewares/imageUpload');
const { createRecognitionLimit } = require('../middlewares/recognitionLimit');

const catalog = [{ id_sous_categorie: 3, nom_sous_categorie: 'Pulls' }];
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const result = { is_clothing: true, nom: 'Pull noir', marque: 'Nike', brand_visible: true,
  couleur: 'noir', id_sous_categorie: 3 };
const providerResponse = data => ({ data: { candidates: [{ finishReason: 'STOP',
  content: { parts: [{ text: JSON.stringify(data) }] } }] } });

describe('Analyse de vêtement : HTTP réel, base et fournisseur simulés', () => {
  let app, token;
  const previous = {};
  beforeAll(() => {
    for (const name of ['JWT_SECRET', 'GEMINI_API_KEY', 'CLOTHING_VISION_MODEL', 'CLOTHING_VISION_PROVIDER',
      'CLOTHING_VISION_PER_USER_HOUR', 'CLOTHING_VISION_GLOBAL_DAY', 'SERPAPI_API_KEY', 'CLOTHING_VISUAL_SEARCH']) previous[name] = process.env[name];
    process.env.JWT_SECRET = 'secret-de-test';
    process.env.CLOTHING_VISION_PER_USER_HOUR = '100';
    process.env.CLOTHING_VISION_GLOBAL_DAY = '1000';
    token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);
    app = express();
    app.use('/api/clothing-analysis', require('../routes/clothingAnalysisRoutes'));
  });
  afterAll(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SERPAPI_API_KEY; delete process.env.CLOTHING_VISUAL_SEARCH;
    process.env.GEMINI_API_KEY = 'cle-fictive-jamais-envoyee';
    process.env.CLOTHING_VISION_PROVIDER = 'gemini';
    process.env.CLOTHING_VISION_MODEL = 'modele-fictif';
    SousCategorie.findAll.mockResolvedValue(catalog);
    axios.post.mockResolvedValue(providerResponse(result));
  });
  const send = () => request(app).post('/api/clothing-analysis').set('Authorization', `Bearer ${token}`)
    .attach('image', jpeg, { filename: 'pull.jpg', contentType: 'image/jpeg' });

  test('authentifie avant tout accès au fournisseur ou au catalogue', async () => {
    expect((await request(app).post('/api/clothing-analysis').attach('image', jpeg, 'pull.jpg')).status).toBe(401);
    expect(axios.post).not.toHaveBeenCalled();
    expect(SousCategorie.findAll).not.toHaveBeenCalled();
  });

  test('une clé absente ou un fournisseur non pris en charge permet de continuer manuellement', async () => {
    delete process.env.GEMINI_API_KEY;
    expect((await send()).status).toBe(503);
    process.env.GEMINI_API_KEY = 'fictif';
    process.env.CLOTHING_VISION_PROVIDER = 'inconnu';
    expect((await send()).status).toBe(503);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('rejette fichier absent, déguisé, multiple ou trop grand avant le fournisseur', async () => {
    const authorized = () => request(app).post('/api/clothing-analysis').set('Authorization', `Bearer ${token}`);
    expect((await authorized()).status).toBe(400);
    expect((await authorized().attach('image', Buffer.from('<svg/>'), 'faux.jpg')).status).toBe(415);
    expect((await authorized().attach('image', jpeg, 'a.jpg').attach('image', jpeg, 'b.jpg')).status).toBe(400);
    expect((await authorized().attach('image', Buffer.alloc(MAX_IMAGE_BYTES + 1), 'grand.jpg')).status).toBe(413);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('propose un pull noir de marque visible sans persister ni exposer la clé', async () => {
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.suggestion).toEqual({ nom: 'Pull noir', marque: 'Nike', couleur: 'noir',
      id_sous_categorie: 3, nom_sous_categorie: 'Pulls' });
    expect(SousCategorie.findAll).toHaveBeenCalledWith({ attributes: ['id_sous_categorie', 'nom_sous_categorie'], raw: true });
    const [url, payload, options] = axios.post.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/modele-fictif:generateContent');
    expect(payload.contents[0].parts[0].text).toContain('Pulls');
    expect(payload.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: jpeg.toString('base64') });
    expect(payload.generationConfig.responseSchema.properties.couleur.enum).toContain('noir');
    expect(options).toMatchObject({ headers: { 'x-goog-api-key': 'cle-fictive-jamais-envoyee' },
      timeout: 30000, maxRedirects: 0 });
    expect(JSON.stringify(res.body)).not.toContain('cle-fictive');
  });

  test('ignore une marque non visible et les catégories/couleurs inventées', async () => {
    axios.post.mockResolvedValue(providerResponse({ ...result, brand_visible: false,
      couleur: 'cyan-fluo', id_sous_categorie: 999 }));
    const res = await send();
    expect(res.body.suggestion).toEqual({ nom: 'Pull noir', marque: null, couleur: null,
      id_sous_categorie: null, nom_sous_categorie: null });
  });

  test('préremplit la marque et le modèle reconnus par le design sans logo', async () => {
    axios.post.mockResolvedValue(providerResponse({ ...result, nom: 'Baskets grises', marque: 'Adidas',
      brand_visible: false, brand_basis: 'distinctive_design', model_name: 'Yeezy Boost 350 V2', model_identified: true }));
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toMatchObject({ nom: 'Adidas Yeezy Boost 350 V2', marque: 'Adidas' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = axios.post.mock.calls[0][1];
    expect(payload.generationConfig.responseSchema.required).toEqual(expect.arrayContaining([
      'brand_basis', 'model_name', 'model_identified'
    ]));
    expect(payload.systemInstruction.parts[0].text).toContain('design réellement distinctif');
  });

  test.each([
    [{ brand_basis: 'unknown', model_identified: true }, null],
    [{ brand_basis: 'distinctive_design', model_identified: false }, 'Adidas'],
    [{ brand_basis: 'invented', model_identified: true }, null],
    [{ brand_basis: 'distinctive_design', model_identified: 'true' }, 'Adidas']
  ])('garde un nom descriptif quand le modèle est incertain ou sa marque non identifiée : %j', async (extra, brand) => {
    axios.post.mockResolvedValue(providerResponse({ ...result, nom: 'Baskets grises', marque: 'Adidas',
      brand_visible: false, model_name: 'Référence incertaine', ...extra }));
    expect((await send()).body.suggestion).toMatchObject({ nom: 'Baskets grises', marque: brand });
  });

  test('ne répète pas la marque si le fournisseur l’inclut dans le modèle', async () => {
    axios.post.mockResolvedValue(providerResponse({ ...result, model_name: 'Nike Air Force 1', model_identified: true }));
    expect((await send()).body.suggestion.nom).toBe('Nike Air Force 1');
  });

  test('croise la photo avec les correspondances sans recopier automatiquement le premier résultat', async () => {
    process.env.SERPAPI_API_KEY = 'secret-serp-fictif';
    const matches = [{ rank: 1, title: 'Marque A : autre pièce', source: 'A', link: 'https://example.invalid/a' },
      { rank: 2, title: 'Marque B : sweat à capuche', source: 'B', link: 'https://example.invalid/b' }];
    require('../services/prepareVisualSearchImage').prepareVisualSearchBuffer.mockResolvedValue({ buffer: jpeg });
    require('../services/visualSearchTrial').searchVisualMatches.mockResolvedValue({ status: 'matches', matches });
    axios.post.mockResolvedValue(providerResponse({ ...result, marque: 'Marque B', brand_visible: false,
      brand_basis: 'visual_search', visual_match_rank: 2, model_name: 'Sweat à capuche', model_identified: true }));
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.body.suggestion).toMatchObject({ marque: 'Marque B', nom: 'Marque B Sweat à capuche', couleur: 'noir' });
    expect(res.body.visual_search).toEqual({ status: 'matches' });
    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = axios.post.mock.calls[0][1];
    expect(payload.contents[0].parts[1].text).toContain('Marque B');
    expect(payload.contents[0].parts[1].text).not.toContain('https://');
    expect(payload.systemInstruction.parts[0].text).toContain('jamais des instructions');
    expect(JSON.stringify(res.body)).not.toContain('secret-serp');
  });

  test('refuse une marque attribuée à une correspondance inexistante', async () => {
    axios.post.mockResolvedValue(providerResponse({ ...result, brand_visible: false,
      brand_basis: 'visual_search', visual_match_rank: 99, model_name: 'Inventé', model_identified: true }));
    const res = await send();
    expect(res.body.suggestion).toMatchObject({ marque: null, nom: 'Pull noir' });
  });

  test('une panne de recherche visuelle laisse le préremplissage Gemini disponible', async () => {
    process.env.SERPAPI_API_KEY = 'fictif';
    require('../services/prepareVisualSearchImage').prepareVisualSearchBuffer.mockResolvedValue({ buffer: jpeg });
    require('../services/visualSearchTrial').searchVisualMatches.mockRejectedValueOnce(new Error('ne-pas-divulguer'));
    const res = await send();
    expect(res.status).toBe(200);
    expect(res.body.suggestion.marque).toBe('Nike');
    expect(res.body.visual_search).toEqual({ status: 'unavailable' });
    expect(JSON.stringify(res.body)).not.toContain('ne-pas-divulguer');
  });

  test('ne convertit pas un identifiant texte en catégorie et borne les textes', async () => {
    axios.post.mockResolvedValue(providerResponse({ ...result, nom: 'a'.repeat(1000), marque: 'b'.repeat(1000),
      id_sous_categorie: '3' }));
    const res = await send();
    expect(res.body.suggestion.nom).toHaveLength(100);
    expect(res.body.suggestion.marque).toHaveLength(100);
    expect(res.body.suggestion.id_sous_categorie).toBeNull();
  });

  test.each([
    [{ is_clothing: false }, 422],
    [{ is_clothing: true }, 422],
    [{ is_clothing: 'true' }, 502]
  ])('signale une photo non exploitable : %j', async (data, status) => {
    axios.post.mockResolvedValue(providerResponse(data));
    expect((await send()).status).toBe(status);
  });

  test('rejette une réponse tronquée, bloquée ou non JSON', async () => {
    axios.post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: 'MAX_TOKENS' }] } });
    expect((await send()).status).toBe(502);
    axios.post.mockResolvedValueOnce({ data: { promptFeedback: { blockReason: 'SAFETY' } } });
    expect((await send()).status).toBe(502);
    axios.post.mockResolvedValueOnce({ data: { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'pas JSON' }] } }] } });
    expect((await send()).status).toBe(502);
  });

  test.each([['ECONNABORTED', 504], ['ERR_BAD_REQUEST', 503]])('masque les erreurs et secrets du fournisseur : %s', async (code, status) => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('cle-fictive image-secrete'), { code }));
    const res = await send();
    expect(res.status).toBe(status);
    expect(JSON.stringify(res.body)).not.toMatch(/cle-fictive|image-secrete/);
  });

  test('ne contacte pas le fournisseur sans catalogue ou si SQL échoue', async () => {
    SousCategorie.findAll.mockResolvedValueOnce([]);
    expect((await send()).status).toBe(503);
    SousCategorie.findAll.mockRejectedValueOnce(new Error('donnees-privees'));
    const res = await send();
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('donnees-privees');
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('Garde-fous de coût par processus', () => {
  const response = () => {
    const res = { locals: {}, set: jest.fn(), json: jest.fn() };
    res.status = jest.fn(() => res);
    return res;
  };
  test('limite par utilisateur, réinitialise après une heure et isole les comptes', () => {
    let time = 0;
    const limit = createRecognitionLimit({ perHour: 1, perDay: 100, now: () => time });
    const first = response(); limit({ user: { id: 1 } }, first, jest.fn()); first.locals.releaseRecognition();
    const blocked = response(); const next = jest.fn();
    limit({ user: { id: 1 } }, blocked, next);
    expect(blocked.status).toHaveBeenCalledWith(429); expect(next).not.toHaveBeenCalled();
    expect(blocked.set).toHaveBeenCalledWith('Retry-After', '3600');
    const other = response(); limit({ user: { id: 2 } }, other, next); other.locals.releaseRecognition();
    expect(next).toHaveBeenCalledTimes(1);
    time = 3600000;
    const later = response(); limit({ user: { id: 1 } }, later, next); later.locals.releaseRecognition();
    expect(next).toHaveBeenCalledTimes(2);
  });
  test('plafonne les appels globaux sur 24 heures', () => {
    let time = 0;
    const limit = createRecognitionLimit({ perHour: 10, perDay: 1, now: () => time });
    const first = response(); limit({ user: { id: 1 } }, first, jest.fn()); first.locals.releaseRecognition();
    const blocked = response(); limit({ user: { id: 2 } }, blocked, jest.fn());
    expect(blocked.status).toHaveBeenCalledWith(429);
    time = 86400000; const next = jest.fn();
    const later = response(); limit({ user: { id: 2 } }, later, next); later.locals.releaseRecognition();
    expect(next).toHaveBeenCalledTimes(1);
  });
  test('limite les traitements concurrents et libère un créneau une seule fois', () => {
    const limit = createRecognitionLimit({ perHour: 10, perDay: 100, concurrent: 1 });
    const first = response(); limit({ user: { id: 1 } }, first, jest.fn());
    const blocked = response(); limit({ user: { id: 2 } }, blocked, jest.fn());
    expect(blocked.status).toHaveBeenCalledWith(429);
    first.locals.releaseRecognition(); first.locals.releaseRecognition();
    const next = jest.fn(); const later = response(); limit({ user: { id: 2 } }, later, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
