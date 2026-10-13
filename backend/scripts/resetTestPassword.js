const path = require('node:path');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

async function resetTestPassword({ email, password }, {
  env = process.env,
  ClientClass = Client,
  hashPassword = bcrypt.hash
} = {}) {
  if (!LOCAL_HOSTS.has(env.DB_HOST) || env.DB_NAME !== 'fits' || env.NODE_ENV === 'production') {
    throw new Error('Réinitialisation réservée à la base de développement fits en local.');
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error('Adresse e-mail invalide.');
  }
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Le nouveau mot de passe doit contenir entre 12 et 128 caractères.');
  }

  const client = new ClientClass({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  });

  try {
    await client.connect();
    const identity = await client.query('SELECT current_database() AS database, host(inet_server_addr()) AS address');
    if (identity.rows[0]?.database !== 'fits' || !LOCAL_HOSTS.has(identity.rows[0]?.address)) {
      throw new Error('Le serveur PostgreSQL ne correspond pas à la base locale attendue.');
    }

    const users = await client.query(
      'SELECT id_utilisateur FROM public.utilisateur WHERE lower(email) = lower($1)',
      [email.trim()]
    );
    if (users.rows.length !== 1) {
      throw new Error('Compte introuvable ou adresse e-mail ambiguë.');
    }

    const hash = await hashPassword(password, 12);
    const updated = await client.query(
      'UPDATE public.utilisateur SET password = $1 WHERE id_utilisateur = $2',
      [hash, users.rows[0].id_utilisateur]
    );
    if (updated.rowCount !== 1) {
      throw new Error('Le compte a changé pendant la réinitialisation ; aucun mot de passe confirmé.');
    }
  } finally {
    await client.end();
  }
}

async function runFromCli() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const [email, password] = input.split(/\r?\n/);
  await resetTestPassword({ email, password });
  console.log('Mot de passe du compte test mis à jour.');
}

if (require.main === module) {
  runFromCli().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { resetTestPassword };
