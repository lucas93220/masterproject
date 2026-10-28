jest.mock('../models/vetement', () => ({ findAll: jest.fn() }));
jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn(async id => ({ id_utilisateur: id, role: 'user' })) }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
jest.mock('../config/db', () => { throw new Error('Aucune base réelle autorisée dans ces tests'); });

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const Vetement = require('../models/vetement');
const { brandCatalogue, normalizeBrand } = require('../services/clothingBrands');
const seed = require('../data/clothingBrands.json');

test('le référentiel contient des noms et alias sans collisions entre marques', () => {
  expect(seed.length).toBeGreaterThan(100);
  const index = new Map();
  for (const brand of seed) {
    expect(brand.name.length).toBeLessThanOrEqual(100);
    for (const name of [brand.name, ...(brand.aliases || [])]) {
      const key = normalizeBrand(name);
      expect(key).not.toBe('');
      if (index.has(key)) expect(index.get(key)).toBe(brand.name);
      index.set(key, brand.name);
    }
  }
});

test('fusionne accents, casse, ponctuation et alias sans renommer les données enregistrées', () => {
  const names = ['NIKE', 'nike', 'Levis', 'sezane', 'Mon Atelier', 'Mon-Atelier', null, '  '];
  const catalog = brandCatalogue(names);
  expect(catalog.filter(b => normalizeBrand(b.name) === 'nike')).toEqual([
    expect.objectContaining({ name: 'Nike', personal: true })
  ]);
  expect(catalog.find(b => b.name === "Levi's").personal).toBe(true);
  expect(catalog.find(b => b.name === 'Sézane').personal).toBe(true);
  expect(catalog.filter(b => normalizeBrand(b.name) === 'monatelier')).toHaveLength(1);
  expect(names[0]).toBe('NIKE');
  expect(brandCatalogue().find(b => b.name === 'Nike').personal).toBe(false);
});

describe('API du catalogue : comptes isolés, modèles simulés', () => {
  const previous = process.env.JWT_SECRET;
  const app = express();
  app.use('/api/brands', require('../routes/brandRoutes'));
  beforeAll(() => { process.env.JWT_SECRET = 'secret-catalogue-de-test'; });
  afterAll(() => {
    if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    Vetement.findAll.mockImplementation(async ({ where }) => [
      { marque: where.id_utilisateur === 1 ? 'Atelier personnel A' : 'Atelier personnel B' }, { marque: 'nike' }
    ]);
  });
  const get = id => request(app).get('/api/brands')
    .set('Authorization', `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`);

  test('requiert une authentification avant toute lecture de vêtements', async () => {
    expect((await request(app).get('/api/brands')).status).toBe(401);
    expect(Vetement.findAll).not.toHaveBeenCalled();
  });
  test('renvoie le catalogue et seulement les marques du compte authentifié', async () => {
    const res = await get(1);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.personalAvailable).toBe(true);
    expect(res.body.brands).toContainEqual(expect.objectContaining({ name: 'Nike', personal: true }));
    expect(res.body.brands).toContainEqual(expect.objectContaining({ name: 'Atelier personnel A', personal: true }));
    expect(JSON.stringify(res.body)).not.toContain('Atelier personnel B');
    expect(Vetement.findAll).toHaveBeenCalledWith({ attributes: ['marque'], where: { id_utilisateur: 1 },
      group: ['marque'], order: [['marque', 'ASC']] });
    const other = await get(2);
    expect(JSON.stringify(other.body)).not.toContain('Atelier personnel A');
  });
  test('reste utilisable avec le catalogue commun si la lecture des marques personnelles échoue', async () => {
    Vetement.findAll.mockRejectedValueOnce(new Error('connexion-privee'));
    const res = await get(1);
    expect(res.status).toBe(200); expect(res.body.personalAvailable).toBe(false);
    expect(res.body.brands).toHaveLength(seed.length);
    expect(JSON.stringify(res.body)).not.toContain('connexion-privee');
  });
});
