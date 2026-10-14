module.exports = {
  // La suite historique importe l'application et écrit dans sa base configurée.
  // Les tests de vrais stockages passent exclusivement par runIsolatedChecks.js.
  testPathIgnorePatterns: ['/node_modules/', '/tests/fits\\.test\\.js$', '/tests/isolated/']
};
