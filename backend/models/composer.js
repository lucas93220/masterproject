const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Composer = sequelize.define('Composer', {
  id_tenue: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'tenue', key: 'id_tenue' }
  },
  id_vetement: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'vetement', key: 'id_vetement' }
  }
}, {
  tableName: 'composer',
  timestamps: false
});

module.exports = Composer;
