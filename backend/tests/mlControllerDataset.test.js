jest.mock("../services/mlClient", () => ({ postToMl: jest.fn() }));
jest.mock("../services/trainingDataset", () => ({ buildTrainingDataset: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base");
});

const { postToMl } = require("../services/mlClient");
const { buildTrainingDataset } = require("../services/trainingDataset");
const { trainModel, predict } = require("../controllers/mlController");

describe("Envoi du dataset au service ML", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test("conserve le contrat POST /train et la réponse existante", async () => {
    const data = [{
      temperature: 18, nb_vetements: 2, nb_favoris: 1, ratio_favoris: 0.5,
      zone_torse: 1, zone_jambes: 1, is_liked: 0
    }];
    buildTrainingDataset.mockResolvedValue(data);
    postToMl.mockResolvedValue({ data: { status: "model trained" } });
    const req = { user: { id: 7 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await trainModel(req, res, next);

    expect(buildTrainingDataset).toHaveBeenCalledWith(7);
    expect(postToMl).toHaveBeenCalledWith("train", { data }, 7);
    expect(res.json).toHaveBeenCalledWith({ message: "Model trained successfully" });
    expect(next).not.toHaveBeenCalled();
  });

  test("conserve le comportement de réentraînement avec un dataset vide", async () => {
    buildTrainingDataset.mockResolvedValue([]);
    postToMl.mockResolvedValue({ data: { status: "insufficient_data", reason: "empty_dataset" } });
    const res = { json: jest.fn() };

    await trainModel({ user: { id: 7 } }, res, jest.fn());

    expect(postToMl).toHaveBeenCalledWith("train", { data: [] }, 7);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "insufficient_data", reason: "empty_dataset"
    }));
  });

  test("transmet les erreurs de construction sans appeler le service ML", async () => {
    const error = new Error("Lecture simulée impossible");
    buildTrainingDataset.mockRejectedValue(error);
    const res = { json: jest.fn() };
    const next = jest.fn();

    await trainModel({ user: { id: 7 } }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(postToMl).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("la prédiction utilise l'identité authentifiée, pas l'identifiant du corps", async () => {
    postToMl.mockResolvedValue({ data: { probability_like: 0.7 } });
    const res = { json: jest.fn() };
    await predict({ user: { id: 7 }, body: { ratio_favoris: 0.5, user_id: 99 } }, res, jest.fn());
    expect(postToMl).toHaveBeenCalledWith("predict", { ratio_favoris: 0.5, user_id: 99 }, 7);
    expect(res.json).toHaveBeenCalledWith({ probability_like: 0.7 });
  });
});
