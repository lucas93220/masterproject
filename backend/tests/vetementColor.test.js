jest.mock('../models/vetement', () => ({ create: jest.fn(), findByPk: jest.fn(), destroy: jest.fn() }));
jest.mock('../models/dressing', () => ({ findOne: jest.fn() }));
jest.mock('../models/contenir', () => ({ create: jest.fn(), findOne: jest.fn() }));
jest.mock('../models/sousCategorie', () => ({}));
jest.mock('../models/categorie', () => ({}));
jest.mock('../models/zone', () => ({}));
jest.mock('../config/db', () => ({ sequelize: { transaction: jest.fn(async callback => callback('test-transaction')) } }));

const Vetement = require('../models/vetement');
const Dressing = require('../models/dressing');
const Contenir = require('../models/contenir');
const { sequelize } = require('../config/db');
const controller = require('../controllers/vetementController');

function response() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

beforeEach(() => {
  jest.clearAllMocks();
  Dressing.findOne.mockResolvedValue({ id_dressing: 4 });
  Contenir.findOne.mockResolvedValue({ id_dressing: 4, id_vetement: 10,
    destroy: jest.fn().mockResolvedValue(undefined) });
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
  expect(Vetement.create).toHaveBeenCalledWith(
    expect.objectContaining({ couleur: 'bleu', id_utilisateur: 1 }),
    { transaction: 'test-transaction' }
  );
  expect(Contenir.create).toHaveBeenCalledWith(
    { id_dressing: 4, id_vetement: 10 }, { transaction: 'test-transaction' }
  );

  jest.clearAllMocks();
  const invalid = { ...valid, body: { ...valid.body, couleur: 'rouge et jaune' } };
  const rejected = response();
  await controller.create(invalid, rejected, next);
  expect(rejected.status).toHaveBeenCalledWith(400);
  expect(Vetement.create).not.toHaveBeenCalled();
  expect(Contenir.create).not.toHaveBeenCalled();
  expect(next).not.toHaveBeenCalled();
});

test('création et lien utilisent la même transaction ; une erreur est propagée', async () => {
  Vetement.create.mockResolvedValue({ id_vetement: 10 });
  Contenir.create.mockRejectedValue(new Error('lien impossible'));
  const next = jest.fn();
  await controller.create({ user: { id: 1 }, body: { nom: 'T-shirt', couleur: 'bleu' } },
    response(), next);
  expect(sequelize.transaction).toHaveBeenCalledTimes(1);
  expect(Vetement.create).toHaveBeenCalledWith(expect.any(Object),
    { transaction: 'test-transaction' });
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'lien impossible' }));
});

test('retirer du dressing conserve le vêtement et ses anciennes tenues', async () => {
  const res = response();
  await controller.delete({ user: { id: 1 }, params: { id: '10' } }, res, jest.fn());
  const relation = await Contenir.findOne.mock.results[0].value;
  expect(relation.destroy).toHaveBeenCalledTimes(1);
  expect(Vetement.destroy).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ message: 'Vêtement retiré du dressing avec succès.' });
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

test('une mise à jour ne modifie pas la clé primaire et refuse la photo d’un autre compte', async () => {
  const garment = { id_vetement: 10, favori: false, save: jest.fn() };
  Vetement.findByPk.mockResolvedValue(garment);
  const next = jest.fn();
  await controller.update({ user: { id: 1 }, params: { id: '10' },
    body: { id_vetement: 99, favori: true } }, response(), next);
  expect(garment.id_vetement).toBe(10);
  expect(garment.favori).toBe(true);
  garment.save.mockClear();
  await controller.update({ user: { id: 1 }, params: { id: '10' },
    body: { photo: '/uploads/u2_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg' } }, response(), next);
  expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));
  expect(garment.save).not.toHaveBeenCalled();
});
