const { Sequelize } = require('sequelize');
const mongoose = require('mongoose');

// SEQUELIZE
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
  }
);

// Vérification connexion PostgreSQL
sequelize.authenticate()
  .then(() => console.log("Connecté à PostgreSQL"))
  .catch(err => console.error("Erreur PostgreSQL :", err));


// MONGOOSE
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connecté à MongoDB"))
  .catch(err => console.error("Erreur MongoDB :", err));

module.exports = { sequelize, mongoose };
