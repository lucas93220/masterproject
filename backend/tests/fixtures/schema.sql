-- Fixture fictive : colonnes et règles relationnelles contrôlées en lecture seule
-- sur le schéma local fits le 13/10/2026. Ne jamais exécuter dans fits.
-- Ce n'est pas une migration ni un dump de données utilisateur.
CREATE TABLE utilisateur (
  id_utilisateur serial PRIMARY KEY, nom varchar NOT NULL, prenom varchar NOT NULL,
  ville varchar, email varchar NOT NULL UNIQUE, password varchar NOT NULL,
  role varchar NOT NULL, telephone varchar, code_postal varchar
);
CREATE TABLE dressing (
  id_dressing serial PRIMARY KEY,
  id_utilisateur integer NOT NULL REFERENCES utilisateur ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE categorie (id_categorie serial PRIMARY KEY, nom_categorie varchar NOT NULL);
CREATE TABLE zone (id_zone serial PRIMARY KEY, nom_zone varchar NOT NULL UNIQUE,
  max_elements integer DEFAULT 1, obligatoire boolean DEFAULT false);
CREATE TABLE sous_categorie (
  id_sous_categorie serial PRIMARY KEY, nom_sous_categorie varchar NOT NULL,
  id_categorie integer NOT NULL REFERENCES categorie ON UPDATE CASCADE ON DELETE RESTRICT,
  id_zone integer NOT NULL REFERENCES zone ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE TABLE vetement (
  id_vetement serial PRIMARY KEY, marque varchar, nom varchar NOT NULL,
  photo text, couleur varchar, favori boolean DEFAULT false,
  temperature_min integer NOT NULL, temperature_max integer NOT NULL,
  id_sous_categorie integer REFERENCES sous_categorie ON UPDATE CASCADE ON DELETE RESTRICT,
  id_utilisateur integer REFERENCES utilisateur ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE TABLE contenir (
  id_dressing integer NOT NULL REFERENCES dressing ON UPDATE CASCADE ON DELETE CASCADE,
  id_vetement integer NOT NULL REFERENCES vetement ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (id_dressing, id_vetement)
);
CREATE TABLE tenue (
  id_tenue serial PRIMARY KEY, date_tenue timestamp NOT NULL DEFAULT now(),
  id_utilisateur integer NOT NULL REFERENCES utilisateur ON UPDATE CASCADE ON DELETE CASCADE,
  temperature integer
);
CREATE TABLE composer (
  id_tenue integer NOT NULL REFERENCES tenue ON UPDATE CASCADE ON DELETE CASCADE,
  id_vetement integer NOT NULL REFERENCES vetement ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (id_tenue, id_vetement)
);
CREATE TABLE evaluation (
  id_utilisateur integer NOT NULL REFERENCES utilisateur ON UPDATE CASCADE ON DELETE CASCADE,
  id_tenue integer NOT NULL REFERENCES tenue ON UPDATE CASCADE ON DELETE CASCADE,
  is_liked boolean NOT NULL, date_avis timestamp NOT NULL DEFAULT now(),
  temperature integer, feature_snapshot jsonb,
  PRIMARY KEY (id_utilisateur, id_tenue)
);
