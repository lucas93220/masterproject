jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock("../models/evaluation", () => ({ upsert: jest.fn() }));
jest.mock("../models/tenue", () => ({ findByPk: jest.fn() }));
jest.mock("../models/composer", () => ({ findAll: jest.fn() }));
jest.mock("../models/vetement", () => ({ findAll: jest.fn() }));
jest.mock("../models/sousCategorie", () => ({}));
jest.mock("../models/zone", () => ({}));
jest.mock("../services/outfitFeatures", () => ({
  loadFeatureSchema: jest.fn(), snapshotGarment: jest.fn()
}));
jest.mock("../config/db", () => {
  throw new Error("Ces tests ne doivent pas ouvrir de connexion à la base");
});

const axios = require("axios");
const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Vetement = require("../models/vetement");
const { loadFeatureSchema, snapshotGarment } = require("../services/outfitFeatures");
const controller = require("../controllers/evaluationController");

describe("Évaluations utilisateur (sans base ni réseau)", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    req = {
      user: { id: 1 },
      body: { id_tenue: 10, is_liked: true },
      headers: { authorization: "Bearer token-fictif" }
    };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    Tenue.findByPk.mockResolvedValue({
      id_tenue: 10,
      id_utilisateur: 1,
      temperature: 18
    });
    Evaluation.upsert.mockImplementation(async data => [data]);
    axios.post.mockResolvedValue({ data: {} });
    Composer.findAll.mockResolvedValue([{ id_tenue: 10, id_vetement: 101 }]);
    Vetement.findAll.mockResolvedValue([{ id_vetement: 101, couleur: "bleu" }]);
    loadFeatureSchema.mockResolvedValue({ version: "outfit-v2-test" });
    snapshotGarment.mockReturnValue({ couleur: "bleu", favori: false,
      zone_name: "torse", category_name: "hauts", subcategory_name: "t-shirt" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each([true, false])("enregistre is_liked=%p et conserve le contrat 201", async isLiked => {
    req.body.is_liked = isLiked;
    await controller.create(req, res, next);

    const expected = {
      id_utilisateur: 1,
      id_tenue: 10,
      is_liked: isLiked,
      temperature: 18,
      date_avis: expect.any(Date),
      feature_snapshot: { version: 1, garments: [snapshotGarment.mock.results[0].value] }
    };
    expect(Tenue.findByPk).toHaveBeenCalledWith(10);
    expect(Evaluation.upsert).toHaveBeenCalledTimes(1);
    expect(Evaluation.upsert).toHaveBeenCalledWith(expected);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expected);
    expect(next).not.toHaveBeenCalled();
    expect(axios.post).toHaveBeenCalledWith("http://127.0.0.1:3002/api/ml/train", {}, {
      headers: { Authorization: "Bearer token-fictif" }, timeout: 16000
    });
    expect(Evaluation.upsert.mock.invocationCallOrder[0])
      .toBeLessThan(axios.post.mock.invocationCallOrder[0]);
  });

  test("enregistre les caractéristiques présentes au moment de l'avis", async () => {
    Composer.findAll.mockResolvedValue([{ id_tenue: 10, id_vetement: 101 }]);
    Vetement.findAll.mockResolvedValue([{ id_vetement: 101, couleur: "bleu" }]);
    loadFeatureSchema.mockResolvedValue({ version: "outfit-v2-test" });
    snapshotGarment.mockReturnValue({ couleur: "bleu", favori: true,
      zone_name: "torse", category_name: "hauts", subcategory_name: "t-shirt" });

    await controller.create(req, res, next);

    expect(Evaluation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      feature_snapshot: { version: 1, garments: [snapshotGarment.mock.results[0].value] }
    }));
    expect(Vetement.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { id_vetement: [101] }
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("une capture d'instantané impossible refuse le vote sans écrire ni entraîner", async () => {
    req.body.is_liked = false;
    Composer.findAll.mockRejectedValue(new Error("Lecture simulée impossible"));

    await controller.create(req, res, next);

    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ message: "Évaluation temporairement indisponible" });
    expect(next).not.toHaveBeenCalled();
  });

  test("refuse une température absente avant toute écriture", async () => {
    Tenue.findByPk.mockResolvedValue({ id_tenue: 10, id_utilisateur: 1, temperature: null });
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Température de la tenue indisponible" });
    expect(Composer.findAll).not.toHaveBeenCalled();
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test.each([
    [],
    [{ id_tenue: 10, id_vetement: 101 }, { id_tenue: 10, id_vetement: 101 }]
  ].map(compositions => [compositions]))("refuse une composition vide ou dupliquée (%p)", async compositions => {
    Composer.findAll.mockResolvedValue(compositions);
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("refuse une composition dont un vêtement a disparu", async () => {
    Vetement.findAll.mockResolvedValue([]);
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("renvoie l'évaluation retournée par l'upsert lors d'un changement d'avis", async () => {
    const updated = { id_tenue: 10, id_utilisateur: 1, is_liked: false, temperature: 18 };
    req.body.is_liked = false;
    Evaluation.upsert.mockResolvedValue([updated, false]);

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  test("refuse une tenue étrangère avec 403, sans écriture ni réentraînement", async () => {
    Tenue.findByPk.mockResolvedValue({ id_tenue: 10, id_utilisateur: 2, temperature: 18 });
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Cette tenue ne vous appartient pas" });
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("conserve 404 pour une tenue introuvable", async () => {
    Tenue.findByPk.mockResolvedValue(null);
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Tenue introuvable" });
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test.each([
    undefined, null, 0, -1, 1.5, "10", "", true, {}, [], NaN, Infinity,
    2147483648, Number.MAX_SAFE_INTEGER
  ].map(value => [value]))("rejette id_tenue=%p avant toute lecture", async value => {
    req.body.id_tenue = value;
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Identifiant de tenue invalide" });
    expect(Tenue.findByPk).not.toHaveBeenCalled();
    expect(Evaluation.upsert).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test.each([undefined, null, "true", "false", 0, 1, {}, []].map(value => [value]))(
    "rejette is_liked=%p sans conversion implicite", async value => {
      req.body.is_liked = value;
      await controller.create(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: "is_liked doit être un booléen" });
      expect(Tenue.findByPk).not.toHaveBeenCalled();
      expect(Evaluation.upsert).not.toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
    }
  );

  test.each([undefined, null])("rejette un corps %p avec 400", async body => {
    req.body = body;
    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Tenue.findByPk).not.toHaveBeenCalled();
    expect(Evaluation.upsert).not.toHaveBeenCalled();
  });

  test("accepte la borne supérieure d'un identifiant PostgreSQL INTEGER", async () => {
    req.body.id_tenue = 2147483647;
    await controller.create(req, res, next);

    expect(Tenue.findByPk).toHaveBeenCalledWith(2147483647);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("conserve l'avis et la réponse 201 si le réentraînement échoue", async () => {
    axios.post.mockRejectedValue(new Error("ML indisponible"));
    await controller.create(req, res, next);

    expect(Evaluation.upsert).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  test("le réentraînement utilise le port réel du backend", async () => {
    const previousPort = process.env.PORT;
    process.env.PORT = "43210";
    try {
      await controller.create(req, res, next);
      expect(axios.post).toHaveBeenCalledWith("http://127.0.0.1:43210/api/ml/train", {}, {
        headers: { Authorization: "Bearer token-fictif" }, timeout: 16000
      });
    } finally {
      if (previousPort === undefined) delete process.env.PORT;
      else process.env.PORT = previousPort;
    }
  });

  test("ne déclenche pas le réentraînement avant la fin de l'enregistrement", async () => {
    let finishSave;
    Evaluation.upsert.mockReturnValue(new Promise(resolve => { finishSave = resolve; }));
    const pending = controller.create(req, res, next);
    await new Promise(resolve => setImmediate(resolve));

    expect(Evaluation.upsert).toHaveBeenCalledTimes(1);
    expect(axios.post).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();

    finishSave([{ id_tenue: 10, is_liked: true }]);
    await pending;
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test.each(["lecture", "écriture"])("transmet une erreur de %s sans entraîner", async operation => {
    const error = new Error("Erreur de base simulée");
    if (operation === "lecture") {
      Tenue.findByPk.mockRejectedValue(error);
    } else {
      Evaluation.upsert.mockRejectedValue(error);
    }

    await controller.create(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
});
