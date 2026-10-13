# FITS — Qualité des évaluations et pipeline ETL

Mesure agrégée du 13 octobre 2026 sur PostgreSQL local `fits`, obtenue avec `backend/scripts/reportEvaluationQuality.js` dans une transaction **READ ONLY**. Aucun identifiant utilisateur, avis individuel ou fichier image n'est publié dans ce document.

| Contrôle | Résultat |
|---|---:|
| Avis bruts | 69 |
| Likes / dislikes bruts | 44 / 25 |
| Utilisateurs ayant des avis | 1 |
| Température absente | 5 |
| Tenue absente ou appartenant à un autre utilisateur | 0 |
| Température de la tenue différente de celle de l'avis | 0 |
| Snapshot absent | 66 |
| Snapshot valide | 3 |
| Lignes renvoyées par le constructeur de dataset pour cet utilisateur | 64 (42 likes / 22 dislikes) |

Les cinq exclusions observées proviennent des températures nulles. La base accepte historiquement `evaluation.temperature = NULL`, bien que le modèle Sequelize actuel l'interdise. Les 66 avis sans snapshot utilisent les vêtements **dans leur état actuel** si leur composition est encore disponible : le dataset peut donc changer après une modification de vêtement. Les trois snapshots valides figent les attributs utilisés à la date de l'avis. Aucun backfill ne peut reconstituer de manière fiable l'ancien état des vêtements sans une source historique indépendante.

**Correctif sur les futurs avis.** `evaluationController.create` vérifie désormais la température de la tenue et la présence d'une composition complète avant l'écriture. Si la capture du snapshot échoue, il répond 503 sans enregistrer l'avis ni déclencher le réentraînement ; une composition invalide ou une température absente répond 409. Un like/dislike valide garde la réponse 201 et son réentraînement actuel. Ce correctif ne modifie pas les 69 avis mesurés ci-dessus et ne répare pas les 66 snapshots historiques absents.

## ETL réellement exécuté par le backend

1. **Extraction** — `backend/services/trainingDataset.js` lit les avis du seul utilisateur authentifié et vérifie les tenues possédées ; il charge les compositions, vêtements, sous-catégories et zones nécessaires.
2. **Contrôles** — il exige un identifiant de tenue entier, une température entière, un booléen `is_liked`, une tenue appartenant au même utilisateur et une température cohérente avec la tenue. Sans snapshot, il exige une composition non vide, sans doublon, et tous les vêtements présents.
3. **Transformation** — si `feature_snapshot` version 1 contient des vêtements, il utilise ces attributs figés ; sinon il lit les attributs courants. `backend/services/outfitFeatures.js` normalise les couleurs, zones, catégories et sous-catégories, calcule les nombres/ratios et indicateurs d'association. Les valeurs inconnues vont dans des buckets explicites ; la version `outfit-v2-<empreinte>` dépend du catalogue.
4. **Chargement ML** — `backend/controllers/mlController.js` transmet les lignes numériques et le label au service Python avec l'identité provenant du JWT. `/train` refuse les jeux vides, à classe unique ou sous les seuils 20 avis / 5 par classe, et conserve le dernier modèle valide en cas d'insuffisance. La prédiction utilise la même construction de features et vérifie version et ordre des colonnes.

**Améliorations sans toucher à l'historique :** produire régulièrement ce rapport agrégé, vérifier sur environnement isolé que les nouveaux avis possèdent bien leur snapshot, journaliser des comptes d'exclusion par raison sans identifiants, et mesurer la dérive du catalogue `outfit-v2`. Pour évaluer une généralisation temporelle, conserver à l'avenir un horodatage fiable dans l'export privé et suffisamment de nouvelles évaluations ; ne pas inventer les attributs des 66 avis passés. Les informations personnelles de l'export d'évaluation restent hors Git, dans un dossier privé, puis sont supprimées.
