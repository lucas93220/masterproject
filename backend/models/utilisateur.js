const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Utilisateur = sequelize.define('utilisateur', {
  id_utilisateur: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  prenom: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ville: {
    type: DataTypes.STRING
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  code_postal: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "user"
  }
}, {
  tableName: 'utilisateur',
  timestamps: false
});

module.exports = Utilisateur;
