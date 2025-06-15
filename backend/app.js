require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./config/db');
const errorHandler = require('./utils/errorHandler');

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const utilisateurRoutes = require('./routes/utilisateurRoutes');
const vetementRoutes = require('./routes/vetementRoutes');
const categorieRoutes = require('./routes/categorieRoutes');
const tenueRoutes = require('./routes/tenueRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const dressingRoutes = require('./routes/dressingRoutes');
const photoRoutes = require('./routes/photoRoutes');
const meteoRoutes = require('./routes/meteoRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/utilisateur', utilisateurRoutes);
app.use('/api/vetement', vetementRoutes);
app.use('/api/categorie', categorieRoutes);
app.use('/api/tenue', tenueRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/dressing', dressingRoutes);
app.use('/api/photo', photoRoutes);
app.use('/api/meteo', meteoRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
