const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SousCategorie = sequelize.define('sous_categorie', {
  id_sous_categorie: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_sous_categorie: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  id_categorie: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  id_zone: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'sous_categorie',
  timestamps: false
});

module.exports = SousCategorie;
