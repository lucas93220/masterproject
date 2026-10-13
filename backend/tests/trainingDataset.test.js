jest.mock("../models/evaluation", () => ({ findAll: jest.fn() }));
jest.mock("../models/tenue", () => ({ findAll: jest.fn() }));
jest.mock("../models/composer", () => ({ findAll: jest.fn() }));
jest.mock("../models/vetement", () => ({ findAll: jest.fn() }));
jest.mock("../models/sousCategorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/categorie", () => ({ findAll: jest.fn() }));
jest.mock("../models/zone", () => ({ findAll: jest.fn() }));
jest.mock("../config/db", () => {
  throw new Error("Ce test ne doit pas ouvrir de connexion à la base");
});

const Evaluation = require("../models/evaluation");
const Tenue = require("../models/tenue");
const Composer = require("../models/composer");
const Vetement = require("../models/vetement");
const Zone = require("../models/zone");
const SousCategorie = require("../models/sousCategorie");
const Categorie = require("../models/categorie");
const { buildTrainingDataset } = require("../services/trainingDataset");
const { loadFeatureSchema, extractFeatures } = require("../services/outfitFeatures");

const zones = [
  { id_zone: 1, nom_zone: "torse" },
  { id_zone: 2, nom_zone: "jambes" },
  { id_zone: 3, nom_zone: "pieds" }
];
const garment = (id, zone, favori = false) => ({
  id_vetement: id,
  id_sous_categorie: id,
  favori,
  couleur: 'bleu',
  sous_categorie: {
    id_sous_categorie: id,
    id_categorie: id,
    zone
  }
});

describe("buildTrainingDataset (données fictives, modèles simulés)", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, is_liked: true, temperature: 18 }
    ]);
    Tenue.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, temperature: 18 }
    ]);
    Composer.findAll.mockResolvedValue([
      { id_tenue: 10, id_vetement: 101 },
      { id_tenue: 10, id_vetement: 102 }
    ]);
    Vetement.findAll.mockResolvedValue([
      garment(101, zones[0], true),
      garment(102, zones[1])
    ]);
    Zone.findAll.mockResolvedValue(zones);
    Categorie.findAll.mockResolvedValue([
      { id_categorie: 101, nom_categorie: 'Hauts' },
      { id_categorie: 102, nom_categorie: 'Bas' },
      { id_categorie: 201, nom_categorie: 'Chaussures' }
    ]);
    SousCategorie.findAll.mockResolvedValue([
      { id_sous_categorie: 101, id_categorie: 101, nom_sous_categorie: 'T-shirt' },
      { id_sous_categorie: 102, id_categorie: 102, nom_sous_categorie: 'Pantalon' },
      { id_sous_categorie: 201, id_categorie: 201, nom_sous_categorie: 'Baskets' }
    ]);
  });

  test("construit la ligne d'un like à partir de plusieurs vêtements", async () => {
    const result = await buildTrainingDataset(1);

    expect(result).toEqual([expect.objectContaining({
      temperature: 18,
      nb_vetements: 2,
      nb_favoris: 1,
      ratio_favoris: 0.5,
      is_liked: 1,
      zone_torse: 1,
      zone_jambes: 1,
      zone_pieds: 0,
      couleur_bleu: 1,
      association_torse_jambes_meme_couleur: 1
    })]);
    expect(Evaluation.findAll).toHaveBeenCalledWith({ where: { id_utilisateur: 1 } });
    expect(Tenue.findAll).toHaveBeenCalledWith({
      where: { id_tenue: [10], id_utilisateur: 1 }
    });
    expect(Composer.findAll).toHaveBeenCalledWith({ where: { id_tenue: [10] } });
    expect(Vetement.findAll).toHaveBeenCalledWith({
      where: { id_vetement: [101, 102] },
      include: { model: SousCategorie, include: Zone }
    });
  });

  test("conserve un dislike explicite avec une cible binaire à zéro", async () => {
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, is_liked: false, temperature: 18 }
    ]);

    const result = await buildTrainingDataset(1);

    expect(result).toHaveLength(1);
    expect(result[0].is_liked).toBe(0);
    expect(result[0].zone_pieds).toBe(0);
  });

  test("conserve ensemble les likes et dislikes d'un utilisateur", async () => {
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, is_liked: true, temperature: 18 },
      { id_utilisateur: 1, id_tenue: 11, is_liked: false, temperature: 12 }
    ]);
    Tenue.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, temperature: 18 },
      { id_utilisateur: 1, id_tenue: 11, temperature: 12 }
    ]);
    Composer.findAll.mockResolvedValue([
      { id_tenue: 10, id_vetement: 101 },
      { id_tenue: 11, id_vetement: 102 }
    ]);

    const result = await buildTrainingDataset(1);

    expect(result).toHaveLength(2);
    expect(result.map(row => row.is_liked)).toEqual([1, 0]);
    expect(result.map(row => row.temperature)).toEqual([18, 12]);
  });

  test("réutilise l'instantané même si le vêtement a été supprimé ou modifié", async () => {
    Evaluation.findAll.mockResolvedValue([{
      id_utilisateur: 1, id_tenue: 10, is_liked: true, temperature: 18,
      feature_snapshot: { version: 1, garments: [{
        couleur: 'bleu', favori: true, zone_name: 'torse',
        category_name: 'hauts', subcategory_name: 't-shirt'
      }] }
    }]);
    Composer.findAll.mockResolvedValue([]);
    Vetement.findAll.mockResolvedValue([]);

    const [row] = await buildTrainingDataset(1);

    expect(row).toEqual(expect.objectContaining({
      is_liked: 1, nb_vetements: 1, nb_favoris: 1,
      couleur_bleu: 1, couleur_rouge: 0, zone_torse: 1
    }));
    expect(Vetement.findAll).not.toHaveBeenCalled();
  });

  test("ne crée aucune ligne négative pour une tenue sans évaluation", async () => {
    Tenue.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, temperature: 18 },
      { id_utilisateur: 1, id_tenue: 11, temperature: 18 }
    ]);
    Composer.findAll.mockResolvedValue([
      { id_tenue: 10, id_vetement: 101 },
      { id_tenue: 11, id_vetement: 102 }
    ]);

    const result = await buildTrainingDataset(1);

    expect(result).toHaveLength(1);
    expect(result[0].is_liked).toBe(1);
  });

  test("isole les évaluations, tenues et compositions de deux utilisateurs", async () => {
    const evaluations = [
      { id_utilisateur: 1, id_tenue: 10, is_liked: true, temperature: 18 },
      { id_utilisateur: 2, id_tenue: 20, is_liked: false, temperature: 12 }
    ];
    const tenues = [
      { id_utilisateur: 1, id_tenue: 10, temperature: 18 },
      { id_utilisateur: 2, id_tenue: 20, temperature: 12 }
    ];
    const compositions = [
      { id_tenue: 10, id_vetement: 101 },
      { id_tenue: 20, id_vetement: 201 }
    ];
    const vetements = [
      garment(101, zones[0], true),
      garment(201, zones[2])
    ];
    Evaluation.findAll.mockImplementation(async ({ where }) =>
      evaluations.filter(item => item.id_utilisateur === where.id_utilisateur));
    Tenue.findAll.mockImplementation(async ({ where }) => tenues.filter(item =>
      item.id_utilisateur === where.id_utilisateur && where.id_tenue.includes(item.id_tenue)));
    Composer.findAll.mockImplementation(async ({ where }) => compositions.filter(item =>
      where.id_tenue.includes(item.id_tenue)));
    Vetement.findAll.mockImplementation(async ({ where }) => vetements.filter(item =>
      where.id_vetement.includes(item.id_vetement)));

    const [first, second] = await Promise.all([
      buildTrainingDataset(1), buildTrainingDataset(2)
    ]);

    expect(first).toEqual([expect.objectContaining({
      temperature: 18, nb_vetements: 1, nb_favoris: 1, ratio_favoris: 1,
      is_liked: 1, zone_torse: 1, zone_jambes: 0, zone_pieds: 0
    })]);
    expect(second).toEqual([expect.objectContaining({
      temperature: 12, nb_vetements: 1, nb_favoris: 0, ratio_favoris: 0,
      is_liked: 0, zone_torse: 0, zone_jambes: 0, zone_pieds: 1
    })]);
  });

  test("ignore un avis renvoyé par erreur pour un autre utilisateur", async () => {
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 2, id_tenue: 10, is_liked: true, temperature: 18 }
    ]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Tenue.findAll).not.toHaveBeenCalled();
  });

  test("ignore une tenue introuvable", async () => {
    Tenue.findAll.mockResolvedValue([]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Composer.findAll).not.toHaveBeenCalled();
  });

  test("ignore une tenue qui n'appartient pas à l'utilisateur", async () => {
    Tenue.findAll.mockResolvedValue([{ id_utilisateur: 2, id_tenue: 10, temperature: 18 }]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Composer.findAll).not.toHaveBeenCalled();
  });

  test.each([
    [{ id_tenue: 10, id_vetement: 101 }],
    [{ id_tenue: 10, id_vetement: 101 }, { id_tenue: 10, id_vetement: 102 }]
  ].map(compositions => [compositions]))("ignore une composition incomplète : %p", async compositions => {
    Composer.findAll.mockResolvedValue(compositions);
    Vetement.findAll.mockResolvedValue([]);
    expect(await buildTrainingDataset(1)).toEqual([]);
  });

  test("ignore une tenue sans composition", async () => {
    Composer.findAll.mockResolvedValue([]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Vetement.findAll).not.toHaveBeenCalled();
  });

  test.each([
    garment(102, zones[1], null),
    garment(102, null)
  ].map(vetement => [vetement]))("encode un vêtement incomplet sans planter : %p", async vetement => {
    Vetement.findAll.mockResolvedValue([
      garment(101, zones[0], true),
      vetement
    ]);
    const result = await buildTrainingDataset(1);
    expect(result).toHaveLength(1);
    expect(result[0].nb_favoris).toBe(1);
  });

  test("ignore les avis incomplets sans assimiler une valeur manquante à un dislike", async () => {
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, is_liked: null, temperature: 18 }
    ]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Tenue.findAll).not.toHaveBeenCalled();
  });

  test("ignore une température incohérente entre avis et tenue", async () => {
    Evaluation.findAll.mockResolvedValue([
      { id_utilisateur: 1, id_tenue: 10, is_liked: true, temperature: 19 }
    ]);
    expect(await buildTrainingDataset(1)).toEqual([]);
  });

  test("renvoie un dataset vide pour un utilisateur sans évaluation", async () => {
    Evaluation.findAll.mockResolvedValue([]);
    expect(await buildTrainingDataset(1)).toEqual([]);
    expect(Tenue.findAll).not.toHaveBeenCalled();
    expect(Composer.findAll).not.toHaveBeenCalled();
    expect(Vetement.findAll).not.toHaveBeenCalled();
  });

  test("a les mêmes features que la prédiction et ne transmet aucun identifiant", async () => {
    const schema = await loadFeatureSchema();
    const vetements = await Vetement.findAll();
    const predictedFeatures = extractFeatures(vetements, 18, schema);

    const [row] = await buildTrainingDataset(1, schema);
    expect(row).toEqual({ ...predictedFeatures, is_liked: 1 });
    expect(Object.keys(row)).not.toContain("id_vetement");
    expect(Object.keys(row)).not.toContain("id_utilisateur");
    expect(Object.values(row).every(value => typeof value === "number" && Number.isFinite(value)))
      .toBe(true);
  });
});
