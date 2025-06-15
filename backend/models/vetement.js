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
  id_categorie: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'categorie', key: 'id_categorie' }
  },
}, {
  tableName: 'vetement',
  timestamps: false
});

module.exports = Vetement;
