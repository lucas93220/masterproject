const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Zone = sequelize.define('zone', {
  id_zone: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_zone: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  max_elements: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  obligatoire: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'zone',
  timestamps: false
});

const SousCategorie = require('./sousCategorie');

Zone.hasMany(SousCategorie, {
  foreignKey: 'id_zone'
});

module.exports = Zone;
