const { resetTestPassword } = require('../scripts/resetTestPassword');

const env = {
  DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'fits',
  DB_USER: 'test', DB_PASSWORD: 'test'
};

function fakeClient(rows = [{ id_utilisateur: 7 }]) {
  const client = {
    connect: jest.fn().mockResolvedValue(),
    end: jest.fn().mockResolvedValue(),
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ database: 'fits', address: '::1' }] })
      .mockResolvedValueOnce({ rows })
      .mockResolvedValueOnce({ rowCount: 1 })
  };
  return { client, ClientClass: jest.fn(() => client) };
}

test('met à jour uniquement le mot de passe du compte demandé avec un hash', async () => {
  const { client, ClientClass } = fakeClient();
  const hashPassword = jest.fn().mockResolvedValue('hash-test');

  await resetTestPassword(
    { email: 'test@example.com', password: 'nouveau-mot-de-passe' },
    { env, ClientClass, hashPassword }
  );

  expect(client.query).toHaveBeenNthCalledWith(2,
    'SELECT id_utilisateur FROM public.utilisateur WHERE lower(email) = lower($1)',
    ['test@example.com']
  );
  expect(hashPassword).toHaveBeenCalledWith('nouveau-mot-de-passe', 12);
  expect(client.query).toHaveBeenNthCalledWith(3,
    'UPDATE public.utilisateur SET password = $1 WHERE id_utilisateur = $2',
    ['hash-test', 7]
  );
  expect(client.end).toHaveBeenCalled();
});

test('ne modifie rien si le compte est absent', async () => {
  const { client, ClientClass } = fakeClient([]);
  const hashPassword = jest.fn();
  await expect(resetTestPassword(
    { email: 'absent@example.com', password: 'nouveau-mot-de-passe' },
    { env, ClientClass, hashPassword }
  )).rejects.toThrow('Compte introuvable');
  expect(hashPassword).not.toHaveBeenCalled();
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.end).toHaveBeenCalled();
});

test('refuse une configuration distante ou une autre base avant connexion', async () => {
  const { ClientClass } = fakeClient();
  for (const override of [{ DB_HOST: 'db.example.com' }, { DB_NAME: 'production' }, { NODE_ENV: 'production' }]) {
    await expect(resetTestPassword(
      { email: 'test@example.com', password: 'nouveau-mot-de-passe' },
      { env: { ...env, ...override }, ClientClass }
    )).rejects.toThrow('Réinitialisation réservée');
  }
  expect(ClientClass).not.toHaveBeenCalled();
});

test('refuse un serveur inattendu et un mot de passe trop court', async () => {
  const { client, ClientClass } = fakeClient();
  client.query.mockReset().mockResolvedValueOnce({ rows: [{ database: 'fits', address: '192.0.2.1' }] });
  await expect(resetTestPassword(
    { email: 'test@example.com', password: 'nouveau-mot-de-passe' },
    { env, ClientClass }
  )).rejects.toThrow('serveur PostgreSQL');
  expect(client.query).toHaveBeenCalledTimes(1);
  expect(client.end).toHaveBeenCalled();

  await expect(resetTestPassword(
    { email: 'test@example.com', password: 'court' },
    { env, ClientClass }
  )).rejects.toThrow('12 et 128');
  expect(ClientClass).toHaveBeenCalledTimes(1);
});
