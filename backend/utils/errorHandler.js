module.exports = (err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599
    ? err.status : 500;
  // Les erreurs Axios/SQL peuvent contenir URL, en-têtes ou valeurs privées.
  console.error(JSON.stringify({ event: 'request_failed', status }));
  res.status(status).json({ message: status < 500 ? err.message : 'Service temporairement indisponible' });
};
