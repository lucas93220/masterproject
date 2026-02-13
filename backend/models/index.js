const Categorie = require('./categorie');
const SousCategorie = require('./sousCategorie');
const Zone = require('./zone');
const Vetement = require('./vetement');


Categorie.hasMany(SousCategorie, {
  foreignKey: 'id_categorie'
});
SousCategorie.belongsTo(Categorie, {
  foreignKey: 'id_categorie'
});

Zone.hasMany(SousCategorie, {
  foreignKey: 'id_zone'
});
SousCategorie.belongsTo(Zone, {
  foreignKey: 'id_zone'
});

SousCategorie.hasMany(Vetement, {
  foreignKey: 'id_sous_categorie'
});
Vetement.belongsTo(SousCategorie, {
  foreignKey: 'id_sous_categorie'
});

module.exports = {
  Categorie,
  SousCategorie,
  Zone,
  Vetement
};
