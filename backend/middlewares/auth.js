const jwt = require('jsonwebtoken');
const Utilisateur = require('../models/utilisateur');
const { hasErasureReceipt } = require('../services/erasureReceipts');

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: "Token manquant" });

  const token = /^Bearer ([^\s]+)$/i.exec(authHeader)?.[1];
  if (!token) return res.status(401).json({ message: "Token manquant" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!Number.isSafeInteger(decoded.id) || decoded.id <= 0 || decoded.id > 2147483647) {
      throw new Error('Identifiant invalide');
    }
  } catch (err) {
    return res.status(401).json({ message: "Token invalide" });
  }
  try {
    if (await hasErasureReceipt(decoded.id)) return res.status(401).json({ message: 'Session expirée' });
    // Un ancien JWT ne doit pas réouvrir un compte supprimé ni conserver un rôle retiré.
    const user = await Utilisateur.findByPk(decoded.id, { attributes: ['id_utilisateur', 'role'] });
    if (!user) return res.status(401).json({ message: 'Session expirée' });
    req.user = { id: user.id_utilisateur, role: user.role };
    next();
  } catch {
    return res.status(503).json({ message: 'Vérification de session indisponible' });
  }
};
