const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Tenue = sequelize.define('tenue', {
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
    allowNull: false
  },
  temperature: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'tenue',
  timestamps: false
});

module.exports = Tenue;