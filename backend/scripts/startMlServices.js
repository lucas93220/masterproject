// Démarre les deux services locaux sans afficher ML_SERVICE_SECRET.
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

if (!process.env.ML_SERVICE_SECRET) {
  throw new Error('ML_SERVICE_SECRET manquant dans l’environnement backend');
}

function localPort(value, fallback) {
  const url = new URL(value || fallback);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Les services ML démarrés localement exigent une URL 127.0.0.1 avec port');
  }
  return url.port;
}

const referencePort = localPort(process.env.ML_SERVICE_URL, 'http://127.0.0.1:8000');
const interactionPort = localPort(process.env.ML_EXPERIMENTAL_URL, 'http://127.0.0.1:8001');
if (referencePort === interactionPort) throw new Error('Ports RF et articles/paires identiques');

const services = [
  { module: 'app:app', port: referencePort, name: 'Référence RF' },
  { module: 'experimental_app:app', port: interactionPort, name: 'Articles/paires' }
];
const environment = {
  ...process.env,
  ML_EXPERIMENTAL_MODELS_DIR: process.env.ML_EXPERIMENTAL_MODELS_DIR ||
    path.join(os.homedir(), '.fits', 'models', 'items-pairs-v1')
};
const python = process.env.ML_PYTHON || 'python3';
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const service of services) {
  const child = spawn(python, ['-m', 'uvicorn', service.module, '--host', '127.0.0.1',
    '--port', service.port, '--workers', '1'], {
    cwd: path.resolve(__dirname, '..', '..', 'ml-service'),
    env: environment,
    stdio: 'inherit'
  });
  children.push(child);
  child.on('error', () => {
    console.error(`Démarrage impossible : ${service.name}`);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping) {
      console.error(`${service.name} arrêté (code ${code ?? 'inconnu'}).`);
      stop(1);
    }
  });
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
