const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Vetement = sequelize.define('Vetement', {
  id_vetement: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true 
    },
  marque: DataTypes.STRING,
  nom: { 
    type: DataTypes.STRING,
    allowNull: false
    },
  photo: DataTypes.STRING,
  couleur: DataTypes.STRING,
  favori: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
    },
  temperature_min: { 
    type: DataTypes.INTEGER, 
    allowNull: false 
    },
  temperature_max: {
     type: DataTypes.INTEGER,
      allowNull: false
     },
  id_sous_categorie: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'sous_categorie', key: 'id_sous_categorie' }
  },
}, {
  tableName: 'vetement',
  timestamps: false
});

const SousCategorie = require('./sousCategorie');

Vetement.belongsTo(SousCategorie, {
  foreignKey: 'id_sous_categorie'
});


module.exports = Vetement;
