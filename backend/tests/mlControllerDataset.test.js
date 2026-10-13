jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../services/trainingDataset", () => ({ buildTrainingDataset: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base");
});

const axios = require("axios");
const { buildTrainingDataset } = require("../services/trainingDataset");
const { trainModel } = require("../controllers/mlController");

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
    axios.post.mockResolvedValue({ data: { status: "model trained" } });
    const req = { user: { id: 7 } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await trainModel(req, res, next);

    expect(buildTrainingDataset).toHaveBeenCalledWith(7);
    expect(axios.post).toHaveBeenCalledWith("http://localhost:8000/train", { data });
    expect(res.json).toHaveBeenCalledWith({ message: "Model trained successfully" });
    expect(next).not.toHaveBeenCalled();
  });

  test("conserve le comportement de réentraînement avec un dataset vide", async () => {
    buildTrainingDataset.mockResolvedValue([]);
    axios.post.mockResolvedValue({ data: {} });
    const res = { json: jest.fn() };

    await trainModel({ user: { id: 7 } }, res, jest.fn());

    expect(axios.post).toHaveBeenCalledWith("http://localhost:8000/train", { data: [] });
  });

  test("transmet les erreurs de construction sans appeler le service ML", async () => {
    const error = new Error("Lecture simulée impossible");
    buildTrainingDataset.mockRejectedValue(error);
    const res = { json: jest.fn() };
    const next = jest.fn();

    await trainModel({ user: { id: 7 } }, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
