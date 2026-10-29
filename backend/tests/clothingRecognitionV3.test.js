jest.mock('axios', () => ({ post: jest.fn() }));
const saved = { FITS_WARDROBE_V3: process.env.FITS_WARDROBE_V3, GEMINI_API_KEY: process.env.GEMINI_API_KEY };
afterAll(() => { for (const [key,value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
test('reconnaissance : propose deux couleurs distinctes et refuse une secondaire hors palette', async () => {
  process.env.FITS_WARDROBE_V3 = '1'; process.env.GEMINI_API_KEY = 'fictif';
  await jest.isolateModulesAsync(async () => {
    const provider = require('axios');
    const { recognizeClothing } = require('../services/clothingRecognition');
    const file = { mimetype: 'image/jpeg', buffer: Buffer.from('fixture') };
    for (const [secondary, expected] of [['écru','écru'],['bleu marine',null],['inventée',null]]) {
      provider.post.mockResolvedValue({ data: { candidates: [{ finishReason:'STOP', content: { parts: [{ text: JSON.stringify({
        is_clothing:true, nom:'Pull', couleur:'bleu marine', couleur_secondaire:secondary, brand_visible:false, marque:'Invention', id_sous_categorie:1
      }) }] } }] } });
      const result = await recognizeClothing(file,[{ id_sous_categorie:1, nom_sous_categorie:'Pull' }]);
      expect(result).toMatchObject({ couleur:'bleu marine', couleur_secondaire:expected, marque:null });
    }
    expect(provider.post.mock.calls[0][1].generationConfig.responseSchema.required).toContain('couleur_secondaire');
  });
});
