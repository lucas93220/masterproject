-- À appliquer avant de déployer le backend de l'étape 3B.
-- La colonne nullable préserve les évaluations historiques.
ALTER TABLE evaluation
  ADD COLUMN IF NOT EXISTS feature_snapshot JSONB;
