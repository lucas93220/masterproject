const request = require('supertest');
const app = require('../app');

describe('Tests FITS', () => {
  let emailTest = `john${Date.now()}@mail.com`;
  let passwordTest = "azerty123";
  let token;
  let vetementId;

  it('Inscription utilisateur', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        nom: "John",
        prenom: "Doe",
        ville: "Paris",
        email: emailTest,
        password: passwordTest,
        role: "user"
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.user).toHaveProperty('email', emailTest);
  });

  it('Connexion OK', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: emailTest,
        password: passwordTest
      });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    token = res.body.token;
  });

  it('Connexion échoue', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: emailTest,
        password: "HmmNanTuTesTrompe"
      });
    expect(res.statusCode).toBe(401);
  });

  it('Ajout vêtement à son dressing', async () => {
    const res = await request(app)
      .post('/api/vetement')
      .set('Authorization', `Bearer ${token}`)
      .send({
        marque: "Adidas",
        nom: "Short",
        couleur: "bleu",
        temperature_min: 15,
        temperature_max: 30,
        id_categorie: 9
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('id_vetement');
    vetementId = res.body.id_vetement;
  });

  it('Voir dressing', async () => {
  const res = await request(app)
    .get('/api/dressing/me')
    .set('Authorization', `Bearer ${token}`);
  expect(res.statusCode).toBe(200);
  expect(Array.isArray(res.body.vetements)).toBe(true);
  expect(res.body.vetements.length).toBeGreaterThan(0);

});


  it('Météo pour la ville utilisateur', async () => {
    const res = await request(app)
      .get('/api/meteo/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ville');
    expect(res.body).toHaveProperty('temperature');
  });

  it('Refus accès météo sans token', async () => {
    const res = await request(app)
      .get('/api/meteo/me');
    expect(res.statusCode).toBe(401);
  });

});
