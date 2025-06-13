require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test de la connexion PostgreSQL
sequelize.authenticate()
  .then(() => console.log('Connecté à PostgreSQL'))
  .catch(err => console.error('Erreur PostgreSQL :', err));


app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
