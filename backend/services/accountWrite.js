const { sequelize } = require('../config/db');
const Utilisateur = require('../models/utilisateur');
const { hasErasureReceipt } = require('./erasureReceipts');

// Le verrou est partagé entre les processus Node via PostgreSQL. La suppression
// prend FOR UPDATE sur la même ligne ; elle attend donc la fin d'une écriture
// déjà engagée, ou fait refuser une écriture arrivée après son commit.
async function withAccountWrite(userId, write) {
  return sequelize.transaction(async transaction => {
    const user = await Utilisateur.findByPk(userId, {
      attributes: ['id_utilisateur'], transaction, lock: transaction.LOCK.KEY_SHARE
    });
    if (!user || await hasErasureReceipt(userId)) {
      throw Object.assign(new Error('Session expirée'), { status: 401 });
    }
    return write();
  });
}
module.exports = { withAccountWrite };
