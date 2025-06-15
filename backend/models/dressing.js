const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Dressing = sequelize.define('Dressing', {
  id_dressing: {
    type: DataTypes.INTEGER, 
    primaryKey: true, 
    autoIncrement: true 
    },
  id_utilisateur: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id_utilisateur' }
  }
}, {
  tableName: 'dressing',
  timestamps: false
});

module.exports = Dressing;
