const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Contenir = sequelize.define('Contenir', {
  id_dressing: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: { model: 'dressing', key: 'id_dressing' }
  },
  id_vetement: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: { model: 'vetement', key: 'id_vetement' }
  }
}, {
  tableName: 'contenir',
  timestamps: false
});

module.exports = Contenir;
