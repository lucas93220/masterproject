jest.mock("axios", () => ({ post: jest.fn() }));
jest.mock('../services/erasureReceipts', () => ({ hasErasureReceipt: jest.fn(async () => false) }));
jest.mock('../models/utilisateur', () => ({ findByPk: jest.fn(async id => ({ id_utilisateur: id, role: 'user' })) }));
jest.mock("../services/mlClient", () => ({ postToMl: jest.fn() }));
jest.mock("../models/dressing", () => ({ findOne: jest.fn() }));
jest.mock("../models/contenir", () => ({ findAll: jest.fn() }));
jest.mock("../models/vetement", () => ({ findAll: jest.fn() }));
jest.mock("../models/sousCategorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/categorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/zone", () => ({ findAll: jest.fn() }));
jest.mock("../models/tenue", () => ({ create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() }));
jest.mock("../models/composer", () => ({ create: jest.fn(), findAll: jest.fn() }));
jest.mock("../models/evaluation", () => ({ upsert: jest.fn(), findAll: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base réelle");
});

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { postToMl } = require("../services/mlClient");
const Dressing = require("../models/dressing");
const Contenir = require("../models/contenir");
const Vetement = require("../models/vetement");
const SousCategorie = require("../models/sousCategorie");
const Categorie = require("../models/categorie");
const Zone = require("../models/zone");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Evaluation = require("../models/evaluation");

// Exemple : ML_TEST_PYTHON=/chemin/vers/python jest --runTestsByPath tests/mlJourney.integration.test.js
const journey = process.env.ML_TEST_PYTHON ? test : test.skip;

journey("génération → dislike → snapshot → dataset → modèles isolés → prédiction/fallback", async () => {
  const previousJwt = process.env.JWT_SECRET;
  const previousPort = process.env.PORT;
  process.env.JWT_SECRET = "integration-jwt-secret";
  process.env.PORT = "43210";
  jest.spyOn(console, "log").mockImplementation(() => {});

  try {
    const zones = [
      { id_zone: 1, nom_zone: "torse", obligatoire: true, max_elements: 1 },
      { id_zone: 2, nom_zone: "jambes", obligatoire: true, max_elements: 1 }
    ];
    const categories = [
      { id_categorie: 1, nom_categorie: "Hauts" },
      { id_categorie: 2, nom_categorie: "Bas" }
    ];
    const subcategories = [
      { id_sous_categorie: 10, id_categorie: 1, nom_sous_categorie: "T-shirt" },
      { id_sous_categorie: 20, id_categorie: 2, nom_sous_categorie: "Pantalon" }
    ];
    const clothing = [
      { id_vetement: 101, id_sous_categorie: 10, couleur: "bleu", favori: true,
        temperature_min: 0, temperature_max: 30,
        sous_categorie: { ...subcategories[0], zone: zones[0] } },
      { id_vetement: 102, id_sous_categorie: 20, couleur: "noir", favori: false,
        temperature_min: 0, temperature_max: 30,
        sous_categorie: { ...subcategories[1], zone: zones[1] } },
      { id_vetement: 201, id_sous_categorie: 10, couleur: "rouge", favori: true,
        temperature_min: 0, temperature_max: 30,
        sous_categorie: { ...subcategories[0], zone: zones[0] } },
      { id_vetement: 202, id_sous_categorie: 20, couleur: "beige", favori: false,
        temperature_min: 0, temperature_max: 30,
        sous_categorie: { ...subcategories[1], zone: zones[1] } }
    ];
    const tenues = [];
    const compositions = [];
    const evaluations = [];
    const mlCalls = [];
    let nextTenueId = 1;

    Zone.findAll.mockResolvedValue(zones);
    Categorie.findAll.mockResolvedValue(categories);
    SousCategorie.findAll.mockResolvedValue(subcategories);
    Dressing.findOne.mockImplementation(async ({ where }) =>
      ({ id_dressing: where.id_utilisateur }));
    Contenir.findAll.mockImplementation(async ({ where }) =>
      (where.id_dressing === 1 ? [101, 102] : [201, 202])
        .map(id_vetement => ({ id_vetement })));
    Vetement.findAll.mockImplementation(async ({ where }) =>
      clothing.filter(item => where.id_vetement.includes(item.id_vetement)));
    Tenue.create.mockImplementation(async data => {
      const row = { ...data, id_tenue: nextTenueId++ };
      tenues.push(row);
      return row;
    });
    Tenue.findByPk.mockImplementation(async id =>
      tenues.find(item => item.id_tenue === id) || null);
    Tenue.findAll.mockImplementation(async ({ where }) => tenues.filter(item =>
      item.id_utilisateur === where.id_utilisateur && where.id_tenue.includes(item.id_tenue)));
    Composer.create.mockImplementation(async data => {
      compositions.push(data);
      return data;
    });
    Composer.findAll.mockImplementation(async ({ where }) => compositions.filter(item =>
      (Array.isArray(where.id_tenue) ? where.id_tenue : [where.id_tenue]).includes(item.id_tenue)));
    Evaluation.upsert.mockImplementation(async data => {
      const existing = evaluations.findIndex(item => item.id_tenue === data.id_tenue &&
        item.id_utilisateur === data.id_utilisateur);
      if (existing >= 0) evaluations[existing] = data;
      else evaluations.push(data);
      return [data];
    });
    Evaluation.findAll.mockImplementation(async ({ where }) => evaluations.filter(item =>
      item.id_utilisateur === where.id_utilisateur));
    postToMl.mockImplementation(async (endpoint, payload, userId) => {
      mlCalls.push({ endpoint, payload, userId });
      if (endpoint === "predict") {
        return { data: { probability_like: payload.ratio_favoris, model_used: "fallback" } };
      }
      const positive = payload.data.filter(row => row.is_liked === 1).length;
      const negative = payload.data.length - positive;
      if (payload.data.length < 20 || positive < 5 || negative < 5) {
        return { data: { status: "insufficient_data", reason: "too_few_samples",
          n_samples: payload.data.length, n_positive: positive, n_negative: negative } };
      }
      return { data: { status: "model trained" } };
    });

    const app = express();
    app.use(express.json());
    app.use("/api/tenue", require("../routes/tenueRoutes"));
    app.use("/api/evaluation", require("../routes/evaluationRoutes"));
    app.use("/api/ml", require("../routes/mlRoutes"));
    app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));
    axios.post.mockImplementation(async (url, _body, options) => {
      expect(url).toBe("http://127.0.0.1:43210/api/ml/train");
      const response = await request(app).post("/api/ml/train")
        .set("Authorization", options.headers.Authorization).send({});
      if (response.status >= 400) throw new Error(response.body.message);
      return { data: response.body };
    });
    const tokenFor = id => `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}`;

    const generated = await request(app).get("/api/tenue/generate?temperature=18")
      .set("Authorization", tokenFor(1));
    expect(generated.status).toBe(200);
    expect(generated.body.vetements).toHaveLength(2);
    const candidate = mlCalls.find(call => call.endpoint === "predict").payload;
    expect(candidate.feature_version).toMatch(/^outfit-v2-/);

    const unauthenticated = await request(app).post("/api/ml/train").send({});
    expect(unauthenticated.status).toBe(401);
    const foreignReview = await request(app).post("/api/evaluation")
      .set("Authorization", tokenFor(2))
      .send({ id_tenue: generated.body.id_tenue, is_liked: true });
    expect(foreignReview.status).toBe(403);
    expect(evaluations).toHaveLength(0);

    const disliked = await request(app).post("/api/evaluation")
      .set("Authorization", tokenFor(1))
      .send({ id_tenue: generated.body.id_tenue, is_liked: false });
    expect(disliked.status).toBe(201);
    expect(evaluations[0].feature_snapshot.version).toBe(2);
    expect(evaluations[0].feature_snapshot.garments.map(item => item.id_vetement))
      .toEqual(generated.body.vetements.map(item => item.id_vetement));
    expect(evaluations[0].feature_snapshot.garments[0].couleur).toBe("bleu");
    expect(mlCalls.find(call => call.endpoint === "train").payload.data).toHaveLength(1);

    clothing[0].couleur = "rouge";
    const retrain = await request(app).post("/api/ml/train")
      .set("Authorization", tokenFor(1)).send({});
    expect(retrain.body.status).toBe("insufficient_data");
    const snapshotRow = mlCalls.filter(call => call.endpoint === "train").at(-1).payload.data[0];
    const { is_liked: _label, ...snapshotFeatures } = snapshotRow;
    const { feature_version: _version, ...candidateFeatures } = candidate;
    expect(snapshotFeatures).toEqual(candidateFeatures);
    expect(snapshotRow.is_liked).toBe(0);

    const snapshot = color => ({ version: 1, garments: [
      { couleur: color, favori: true, zone_name: "torse",
        category_name: "hauts", subcategory_name: "t-shirt" },
      { couleur: "noir", favori: false, zone_name: "jambes",
        category_name: "bas", subcategory_name: "pantalon" }
    ] });
    for (let index = 0; index < 19; index++) {
      const id = nextTenueId++;
      tenues.push({ id_tenue: id, id_utilisateur: 1, temperature: 18 });
      evaluations.push({ id_tenue: id, id_utilisateur: 1, temperature: 18,
        is_liked: index < 10, feature_snapshot: snapshot(index < 10 ? "bleu" : "rouge") });
    }
    for (let index = 0; index < 20; index++) {
      const id = nextTenueId++;
      tenues.push({ id_tenue: id, id_utilisateur: 2, temperature: 18 });
      evaluations.push({ id_tenue: id, id_utilisateur: 2, temperature: 18,
        is_liked: index < 10, feature_snapshot: snapshot(index < 10 ? "rouge" : "bleu") });
    }

    const trainedOne = await request(app).post("/api/ml/train")
      .set("Authorization", tokenFor(1)).send({});
    const trainedTwo = await request(app).post("/api/ml/train")
      .set("Authorization", tokenFor(2)).send({});
    const empty = await request(app).post("/api/ml/train")
      .set("Authorization", tokenFor(3)).send({});
    expect(trainedOne.body.message).toBe("Model trained successfully");
    expect(trainedTwo.body.message).toBe("Model trained successfully");
    expect(empty.body.status).toBe("insufficient_data");
    const trainOne = mlCalls.filter(call => call.endpoint === "train" && call.userId === 1).at(-1).payload;
    const trainTwo = mlCalls.filter(call => call.endpoint === "train" && call.userId === 2).at(-1).payload;
    const emptyPayload = mlCalls.filter(call => call.endpoint === "train" && call.userId === 3).at(-1).payload;
    expect(trainOne.data).toHaveLength(20);
    expect(trainTwo.data).toHaveLength(20);
    expect(emptyPayload.data).toEqual([]);
    expect(trainOne.data.filter(row => row.is_liked === 1)).toHaveLength(10);
    expect(trainTwo.data.filter(row => row.is_liked === 1)).toHaveLength(10);

    const bridge = spawnSync(process.env.ML_TEST_PYTHON,
      [path.join(__dirname, "helpers/python_ml_bridge.py")], {
        input: JSON.stringify({ train_one: trainOne, train_two: trainTwo,
          empty: emptyPayload, candidate }), encoding: "utf8", timeout: 60000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
      });
    if (bridge.error) throw new Error(`${bridge.error.message}\n${bridge.stderr}`);
    expect(bridge.status).toBe(0);
    const result = JSON.parse(bridge.stdout);
    expect(result.empty.body.status).toBe("insufficient_data");
    expect(result.train_one.body.status).toBe("model trained");
    expect(result.train_two.body.status).toBe("model trained");
    expect(result.saved_files).toEqual(["user_1.joblib", "user_2.joblib"]);
    expect(result.predict_one.body.model_used).toBe("personalized");
    expect(result.predict_two.body.model_used).toBe("personalized");
    expect(result.predict_one.body.probability_like)
      .toBeGreaterThan(result.predict_two.body.probability_like);
    expect(result.predict_three.body).toEqual({ probability_like: 0.5,
      model_used: "fallback", reason: "no_model" });

    postToMl.mockImplementation(async (endpoint, _payload, userId) => {
      expect(endpoint).toBe("predict");
      expect(userId).toBe(1);
      return { data: result.predict_one.body };
    });
    const generatedWithModel = await request(app).get("/api/tenue/generate?temperature=18")
      .set("Authorization", tokenFor(1));
    expect(generatedWithModel.status).toBe(200);
    expect(generatedWithModel.body.vetements).toHaveLength(2);
  } finally {
    jest.restoreAllMocks();
    if (previousJwt === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwt;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
  }
});
