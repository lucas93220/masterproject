-- Exécution explicite seulement, après sauvegarde. Aucun avis/vêtement existant modifié.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE vetement ADD COLUMN IF NOT EXISTS couleur_secondaire varchar(255);
LOCK TABLE categorie, zone, sous_categorie IN SHARE ROW EXCLUSIVE MODE;
-- Zones facultatives : ajout seulement si absentes, aucune règle existante changée.
INSERT INTO zone(nom_zone,max_elements,obligatoire) VALUES
  ('yeux',1,false),('cou',1,false),('taille',1,false),('sac',1,false)
  ON CONFLICT (nom_zone) DO NOTHING;
DO $$
DECLARE entry record; parent_id integer; zone_id integer; matches integer;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('T-shirt','Vêtements','torse'),('T-shirt manches longues','Vêtements','torse'),
    ('Débardeur','Vêtements','torse'),('Chemise','Vêtements','torse'),('Polo','Vêtements','torse'),
    ('Pull','Vêtements','torse'),('Cardigan','Vêtements','torse'),('Gilet','Vêtements','torse'),
    ('Sweat','Vêtements','torse'),('Sweat zippé','Vêtements','torse'),
    ('Bomber','Vêtements','exterieur'),('Veste légère','Vêtements','exterieur'),
    ('Blazer','Vêtements','exterieur'),('Manteau','Vêtements','exterieur'),('Doudoune','Vêtements','exterieur'),
    ('Jean','Vêtements','jambes'),('Pantalon','Vêtements','jambes'),('Jogging','Vêtements','jambes'),('Short','Vêtements','jambes'),
    ('Baskets','Chaussures','pieds'),('Bottines','Chaussures','pieds'),('Bottes','Chaussures','pieds'),
    ('Mocassins','Chaussures','pieds'),('Sandales','Chaussures','pieds'),
    ('Casquette','Accessoires','tete'),('Bonnet','Accessoires','tete'),('Lunettes de soleil','Accessoires','yeux'),
    ('Écharpe','Accessoires','cou'),('Sac','Accessoires','sac'),('Ceinture','Accessoires','taille')
  ) AS seed(name,parent,zone_name) LOOP
    SELECT count(*),min(id_categorie) INTO matches,parent_id FROM categorie
      WHERE lower(nom_categorie)=lower(entry.parent);
    IF matches <> 1 THEN RAISE EXCEPTION 'Famille absente ou ambiguë : %',entry.parent; END IF;
    SELECT count(*),min(id_zone) INTO matches,zone_id FROM zone WHERE lower(nom_zone)=entry.zone_name;
    IF matches <> 1 THEN RAISE EXCEPTION 'Zone absente ou ambiguë : %',entry.zone_name; END IF;
    IF NOT EXISTS (SELECT 1 FROM sous_categorie WHERE lower(nom_sous_categorie)=lower(entry.name)
      AND id_categorie=parent_id AND id_zone=zone_id) THEN
      INSERT INTO sous_categorie(nom_sous_categorie,id_categorie,id_zone) VALUES(entry.name,parent_id,zone_id);
    END IF;
  END LOOP;
END $$;
COMMIT;
