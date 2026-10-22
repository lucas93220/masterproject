-- À exécuter après sauvegarde, avant le redémarrage du backend.
-- La colonne reste nullable : un vêtement historique sans lien fiable n'est pas attribué au hasard.
BEGIN;

ALTER TABLE vetement ADD COLUMN IF NOT EXISTS id_utilisateur integer;

WITH liens AS (
  SELECT c.id_vetement, d.id_utilisateur
  FROM contenir c JOIN dressing d ON d.id_dressing = c.id_dressing
  UNION
  SELECT c.id_vetement, t.id_utilisateur
  FROM composer c JOIN tenue t ON t.id_tenue = c.id_tenue
), proprietaire_unique AS (
  SELECT id_vetement, MIN(id_utilisateur) AS id_utilisateur
  FROM liens
  GROUP BY id_vetement
  HAVING COUNT(DISTINCT id_utilisateur) = 1
)
UPDATE vetement v SET id_utilisateur = p.id_utilisateur
FROM proprietaire_unique p
WHERE v.id_vetement = p.id_vetement AND v.id_utilisateur IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'vetement'::regclass AND conname = 'vetement_id_utilisateur_fkey'
  ) THEN
    ALTER TABLE vetement ADD CONSTRAINT vetement_id_utilisateur_fkey
      FOREIGN KEY (id_utilisateur) REFERENCES utilisateur(id_utilisateur)
      ON UPDATE CASCADE ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;

-- Vérification après migration :
-- SELECT COUNT(*) AS proprietaire_inconnu FROM vetement WHERE id_utilisateur IS NULL;
-- Retour arrière possible après sauvegarde et retour à l'ancien code :
-- ALTER TABLE vetement DROP COLUMN id_utilisateur;
