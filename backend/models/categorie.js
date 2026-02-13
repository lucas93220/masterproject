const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Categorie = sequelize.define('categorie', {
  id_categorie: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom_categorie: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'categorie',
  timestamps: false
});

module.exports = Categorie;
