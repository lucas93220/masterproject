const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Tenue = sequelize.define('Tenue', {
  id_tenue: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
    },
  date_tenue: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
    },
  id_utilisateur: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id_utilisateur' }
  }
}, {
  tableName: 'tenue',
  timestamps: false
});

module.exports = Tenue;
