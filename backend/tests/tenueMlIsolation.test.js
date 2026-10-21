jest.mock("../services/mlClient", () => ({ postToMl: jest.fn() }));
jest.mock("../services/outfitFeatures", () => ({
  loadFeatureSchema: jest.fn(), extractFeatures: jest.fn()
}));
jest.mock("../models/vetement", () => ({ findAll: jest.fn() }));
jest.mock("../models/sousCategorie", () => ({}));
jest.mock("../models/zone", () => ({ findAll: jest.fn() }));
jest.mock("../models/dressing", () => ({ findOne: jest.fn() }));
jest.mock("../models/contenir", () => ({ findAll: jest.fn() }));
jest.mock("../models/tenue", () => ({ create: jest.fn() }));
jest.mock("../models/composer", () => ({ create: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base");
});

const { postToMl } = require("../services/mlClient");
const { loadFeatureSchema, extractFeatures } = require("../services/outfitFeatures");
const Vetement = require("../models/vetement");
const Zone = require("../models/zone");
const Dressing = require("../models/dressing");
const Contenir = require("../models/contenir");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const { generateTenue } = require("../controllers/tenueController");

test("la génération conserve le parcours et prédit avec l'utilisateur authentifié", async () => {
  jest.clearAllMocks();
  const zone = { id_zone: 1, nom_zone: "torse", obligatoire: true, max_elements: 1 };
  const vetement = {
    id_vetement: 12, id_sous_categorie: 3, temperature_min: 0,
    temperature_max: 30, favori: true, sous_categorie: { zone }
  };
  Dressing.findOne.mockResolvedValue({ id_dressing: 4 });
  Contenir.findAll.mockResolvedValue([{ id_vetement: 12 }]);
  Vetement.findAll.mockResolvedValue([vetement]);
  Zone.findAll.mockResolvedValue([zone]);
  loadFeatureSchema.mockResolvedValue({ version: "outfit-v2-test" });
  extractFeatures.mockReturnValue({
    temperature: 18, nb_vetements: 1, nb_favoris: 1,
    ratio_favoris: 1, zone_torse: 1
  });
  postToMl.mockResolvedValue({ data: { predictions: [{ probability_like: 1, model_used: "fallback" }] } });
  Tenue.create.mockResolvedValue({ id_tenue: 22 });
  Composer.create.mockResolvedValue({});
  const req = { user: { id: 7 }, query: { temperature: "18" } };
  const res = { json: jest.fn() };
  const next = jest.fn();

  await generateTenue(req, res, next);

  expect(postToMl).toHaveBeenCalledWith("predict-batch", {
    feature_version: "outfit-v2-test", representation_version: "items-pairs-v1",
    candidates: [{ temperature: 18, nb_vetements: 1, nb_favoris: 1,
      ratio_favoris: 1, zone_torse: 1, garment_ids: [12] }]
  }, 7);
  expect(postToMl).toHaveBeenCalledTimes(1);
  expect(Tenue.create).toHaveBeenCalledWith({ id_utilisateur: 7, temperature: 18 });
  expect(Composer.create).toHaveBeenCalledWith({ id_tenue: 22, id_vetement: 12 });
  expect(res.json).toHaveBeenCalledWith({ id_tenue: 22, vetements: [vetement],
    recommendation: { model_used: 'fallback', reason: null } });
  expect(next).not.toHaveBeenCalled();

  // The normal model is identifiable in the response, without changing the outfit contract.
  {
    postToMl.mockResolvedValue({ data: { predictions: [{ probability_like: 0.8,
      model_used: 'personalized', model_variant: 'items-pairs-v1', model_revision: 'test-revision' }] } });
    res.json.mockClear();
    await generateTenue(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ id_tenue: 22, vetements: [vetement],
      recommendation: { model_used: 'personalized', reason: null,
        model_variant: 'items-pairs-v1', model_revision: 'test-revision' } });
    expect(postToMl).toHaveBeenLastCalledWith('predict-batch', expect.objectContaining({
      candidates: [expect.objectContaining({ garment_ids: [12] })]
    }), 7);
    expect(next).not.toHaveBeenCalled();
  }
});

test('rejette une température non numérique avant la lecture du dressing', async () => {
  jest.clearAllMocks();
  const req = { user: { id: 7 }, query: { temperature: 'abc' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();

  await generateTenue(req, res, next);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(Dressing.findOne).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});
