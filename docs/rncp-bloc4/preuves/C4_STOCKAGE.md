# C4 — Bases de données et performance des requêtes

**Critère de la grille validée :** choisir une structure de données adaptée aux traitements analytiques et à l'IA, mesurer les requêtes et justifier les optimisations.

## Preuves disponibles

- Le [schéma et ses écarts constatés](../ETAT_ACTUEL.md#c4--conception-et-mesure-des-stockages) relient utilisateur, dressing, vêtement, tenue et évaluation. PostgreSQL porte les relations, clés et transactions ; `evaluation.feature_snapshot` est un JSONB versionné. MongoDB contient des logs et une voie photo, hors entraînement. [diagnosePostgres.js](../../../backend/scripts/diagnosePostgres.js) lit contraintes et plans avec une transaction `READ ONLY`.
- Au relevé local du 13/10/2026, la base contenait 385 tenues et 171 avis. Cinq lectures par utilisateur donnaient des médianes SQL de `0,044 ms` pour ses tenues et `0,020 ms` pour ses avis. Ces temps excluent ORM, HTTP, réseau et concurrence.
- Une expérience reproductible avec [benchmarkIsolatedStorage.js](../../../backend/scripts/benchmarkIsolatedStorage.js) a créé 100 comptes et jusqu'à **100 000 tenues fictives** dans un PostgreSQL temporaire. Pour la même requête `tenue WHERE id_utilisateur = 42`, la médiane à 100 000 lignes passe de `2,081 ms` à `0,139 ms` avec un index B-tree ; l'index occupe `728 Kio`. Les [données et plans](../benchmark_stockage_synthetique.json) et le [visuel](../visuels/stockage_synthetique.svg) distinguent explicitement cette expérience des données réelles.
- La clé composée existante d'`evaluation` sert déjà aux avis d'un compte. Le test de suppression/rollback et celui de restauration PostgreSQL se trouvent dans le [pipeline isolé](../../../backend/tests/isolated/pipeline.test.js).

## Décision et limites

L'index devient intéressant sur **ce jeu fictif uniforme** à 1 % de sélectivité. La charge réelle de FITS est trop faible pour justifier aujourd'hui une migration : coût d'écriture, distribution des données, charge concurrente, latence de l'application et énergie n'ont pas été mesurés. Aucune migration réelle n'a été lancée. Si l'usage augmente, mesurer d'abord les requêtes et leur fréquence sur une copie isolée, puis arbitrer l'index avec son coût d'entretien.
