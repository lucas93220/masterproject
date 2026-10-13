jest.mock('../models/vetement', () => ({ create: jest.fn(), findByPk: jest.fn() }));
jest.mock('../models/dressing', () => ({ findOne: jest.fn() }));
jest.mock('../models/contenir', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/sousCategorie', () => ({}));
jest.mock('../models/categorie', () => ({}));
jest.mock('../models/zone', () => ({}));
jest.mock('../config/db', () => {
  throw new Error('Ce test ne doit pas ouvrir de connexion à la base');
});

const Vetement = require('../models/vetement');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const controller = require('../controllers/vetementController');

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  Dressing.findOne.mockResolvedValue({ id_dressing: 4 });
  Contenir.findOne.mockResolvedValue({ id_dressing: 4, id_vetement: 10 });
  Contenir.create.mockResolvedValue({});
});

test('création : normalise une couleur connue et refuse un texte libre ou deux couleurs', async () => {
  Vetement.create.mockImplementation(async data => ({ ...data, id_vetement: 10 }));
  const valid = { user: { id: 1 }, body: { nom: 'T-shirt', couleur: 'Bleue',
    temperature_min: 10, temperature_max: 30, id_sous_categorie: 2 } };
  const res = response();
  const next = jest.fn();
  await controller.create(valid, res, next);
  expect(res.status).toHaveBeenCalledWith(201);
  expect(Vetement.create).toHaveBeenCalledWith(expect.objectContaining({ couleur: 'bleu' }));

  jest.clearAllMocks();
  const invalid = { ...valid, body: { ...valid.body, couleur: 'rouge et jaune' } };
  const rejected = response();
  await controller.create(invalid, rejected, next);
  expect(rejected.status).toHaveBeenCalledWith(400);
  expect(Vetement.create).not.toHaveBeenCalled();
  expect(Contenir.create).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('mise à jour : un ancien vêtement reste modifiable sans changer sa couleur', async () => {
  const garment = { couleur: 'bleu marine', favori: false, save: jest.fn() };
  Vetement.findByPk.mockResolvedValue(garment);
  const res = response();
  await controller.update({ user: { id: 1 }, params: { id: '10' },
    body: { favori: true } }, res, jest.fn());
  expect(garment.couleur).toBe('bleu marine');
  expect(garment.favori).toBe(true);
  expect(garment.save).toHaveBeenCalledTimes(1);
});

test('mise à jour : une couleur hors palette est refusée avant écriture', async () => {
  const garment = { couleur: 'noir', save: jest.fn() };
  Vetement.findByPk.mockResolvedValue(garment);
  const res = response();
  await controller.update({ user: { id: 1 }, params: { id: '10' },
    body: { couleur: 'rouge et jaune' } }, res, jest.fn());
  expect(res.status).toHaveBeenCalledWith(400);
  expect(garment.save).not.toHaveBeenCalled();
});
