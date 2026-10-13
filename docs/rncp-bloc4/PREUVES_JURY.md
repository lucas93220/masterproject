# FITS — Preuves disponibles pour les cinq compétences du bloc 4

La grille officielle RNCP40573/BC04B n'est pas dans le dépôt ; ces regroupements C1–C5 suivent la mission reçue et doivent être rapprochés des libellés officiels avant l'oral. Voir `AUDIT.md` pour les limites détaillées.

| Axe | Preuve technique à montrer | Résultat honnête et limite |
|---|---|---|
| **C1 — Analyse Big Data** | Diagramme des sources dans `AUDIT.md`, comptages agrégés par `backend/scripts/reportEvaluationQuality.js`, architecture mobile/Node/PostgreSQL/Mongo/Python | 69 avis bruts, un utilisateur évaluateur : FITS est un prototype à faible volume. La variété existe, débit et montée en charge restent non mesurés. |
| **C2 — Machine Learning** | `backend/services/outfitFeatures.js`, `trainingDataset.js`, `ml-service/app.py`, `evaluate.py`, `evaluate_robust.py`, tests Python et `PERFORMANCES_ML.md` | Modèle personnalisé et fallback démontrables. Sur 30 séparations contrôlées, RF accuracy moyenne 0,582 contre 0,638 pour la majorité ; aucune amélioration prédictive prouvée. Les métriques de classement sont des proxys, pas un NDCG@5. |
| **C3 — ETL et qualité** | `QUALITE_DONNEES.md`, `backend/controllers/evaluationController.js`, `backend/services/trainingDataset.js`, tests de snapshot/dataset | 5/69 avis exclus pour température manquante, 3 snapshots valides ; risques de dérive historique explicités. Aucun backfill inventé. |
| **C4 — Base de données** | Schéma et contraintes dans `AUDIT.md`, migration `backend/migrations/20261013_add_evaluation_feature_snapshot.sql`, rapport agrégé READ ONLY | Clés et intégrité observées localement ; `evaluation.temperature` nullable en base explique cinq exclusions. Aucun benchmark ou index supplémentaire revendiqué. |
| **C5 — Architecture/intégration** | `backend/tests/mlJourney.integration.test.js`, `ml-service/demo_isolated.py`, `SECURITE_UPLOADS.md`, tests d'inscription et d'upload | Isolation utilisateur et fallback démontrables avec fichiers temporaires. Inscription sécurisée contre `role=admin` et upload authentifié ; lecture publique des images disque et résilience ML restent des limites. |

**Démo courte recommandée :** lancer `demo_isolated.py` pour montrer `personalized` et `fallback` sans toucher au modèle utilisé par l'application, puis présenter le tableau de performances réelles avec la baseline et les limites. Ne jamais afficher de secret, de JWT, de données individuelles ou les fichiers image lors de l'oral.
