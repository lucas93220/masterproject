const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Evaluation = sequelize.define('Evaluation', {
  id_utilisateur: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'utilisateur', key: 'id_utilisateur' }
  },
  id_tenue: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    references: { model: 'tenue', key: 'id_tenue' }
  },
  is_liked: {
    type: DataTypes.BOOLEAN,
    allowNull: false
    },
  date_avis: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
    }
}, {
  tableName: 'evaluation',
  timestamps: false
});

module.exports = Evaluation;
