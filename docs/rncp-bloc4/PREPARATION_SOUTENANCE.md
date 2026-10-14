# FITS — Préparation pratique de la soutenance

Ce guide regroupe les commandes sûres, la démo et le protocole des volontaires. Les faits et métriques sont dans [l'état actuel](ETAT_ACTUEL.md), les pièces à montrer dans les [fiches C1–C5](preuves/) et la trame orale dans [SOUTENANCE.md](SOUTENANCE.md). Ne montrer ni `.env`, JWT, secret ML, e-mail, export individuel, ni photographie privée.

## Preuves par compétence

| Axe | Pièce à montrer | Phrase juste et limite |
|---|---|---|
| C1 — besoin/3V | [Fiche C1](preuves/C1_BESOIN.md) | Finalités définies ; effets encore non mesurés auprès de volontaires. |
| C2 — conception/évaluation ML | [Fiche C2](preuves/C2_MODELE.md) | RF sous la baseline majoritaire dans les deux comptes évalués séparément. |
| C3 — ETL/qualité/protection | [Fiche C3](preuves/C3_DONNEES.md) | Snapshots et protections testés ; exploitation réelle de l'historique et des sauvegardes incomplète. |
| C4 — bases de données | [Fiche C4](preuves/C4_STOCKAGE.md) | Index mesuré sur données fictives, sans migration réelle. |
| C5 — programme IA | [Fiche C5](preuves/C5_PROGRAMME.md) | Pipeline, isolation et fallback testés ; bénéfice métier non prouvé par ces tests. |

Les [visuels](visuels/) sont datés et décrits dans les fiches. Le graphique RF/baseline porte sur l'ancien compte ; le compte récent est documenté séparément dans C2. Ne pas mélanger leurs chiffres.

## Démo isolée et tests sûrs

**Vérification finale du 14/10/2026 : 222 tests réussis** : 159 backend (22 suites), six scénarios avec vrais stockages temporaires, 35 Python et 22 mobile. Un essai intermédiaire antérieur du pont Python a atteint son délai de 60 s ; relancé seul puis dans les suites finales, il a réussi sans modification du modèle. La cause de cet incident ponctuel n'a pas été établie. Les tests n'ont pas modifié les données applicatives ; l'essai d'interactions local décrit dans la [fiche C2](preuves/C2_MODELE.md) est en lecture seule.

Les fichiers npm `package.json`/`package-lock.json` ne sont plus ignorés par Git. Après récupération du dépôt, installer avec `npm ci` dans `backend` et `mobile`. Sur le Mac utilisé :

```sh
# Depuis backend : le fichier jest.config.js exclut les tests dangereux par défaut.
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm test -- --runInBand

# Depuis mobile : réutilise Jest déjà présent dans backend.
../backend/node_modules/.bin/jest --runInBand tests
```

Pour le test complet, `initdb`, `pg_ctl`, `pg_dump` et `pg_restore` (PostgreSQL 14 utilisé pour la preuve) doivent être sur le PATH. Le lanceur crée **un nouveau cluster PostgreSQL**, avec socket Unix dans son dossier privé, **un nouveau MongoDB** sur un port loopback libre et **un nouveau FastAPI** avec secret de test et dossier Joblib temporaire. Il vérifie leurs répertoires avant écriture et les arrête/nettoie à la fin ; il ne charge aucun `.env`. La fixture SQL reproduit les colonnes/nullabilités et contraintes vérifiées en lecture seule ; elle n'est pas une migration.

```sh
# Depuis backend ; macOS ARM64, Python 3.13 avec les dépendances du service ML.
# Facultatif si mongod est déjà disponible : téléchargement officiel isolé du serveur.
export FITS_TEST_MONGOD="$(/opt/anaconda3/bin/python3 scripts/prepareMongoTestTool.py)"
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm run test:isolated

# Même test suivi du benchmark C4 ; le fichier de sortie doit ne pas exister.
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm run test:isolated -- \
  --benchmark-report /private/tmp/fits-benchmark-reproduction.json
```

L'outil Mongo téléchargé est la version **8.0.16**, vérifiée contre son SHA256 publié, décompressée sous `/private/tmp/fits-mongo-tool-*`, sans service système installé. Réutiliser le même binaire pour les essais ; supprimer ensuite uniquement ce dossier de téléchargement si souhaité. Le téléchargement requiert Internet ; une fois les outils installés, le test fonctionne localement. Source : [installation par archive officielle MongoDB](https://www.mongodb.com/docs/v8.0/tutorial/install-mongodb-on-os-x-tarball/). Il ne teste pas les droits, la réplication ou les sauvegardes du cluster Mongo distant existant.

Depuis la racine du dépôt, les commandes suivantes n'écrivent ni dans PostgreSQL ni dans les Joblib de l'application. Installer les dépendances du projet dans un environnement isolé si nécessaire ; `ml-service/requirements.txt` décrit les versions directes. `demo_isolated.py` utilise un secret fictif, 30 lignes synthétiques et un dossier temporaire.

```sh
cd ml-service
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 demo_isolated.py
```

Sortie attendue observée le 13/10/2026 : `train_status: model trained`, `meme_utilisateur: personalized`, `autre_utilisateur: fallback`, `raison_fallback: no_model`. Vérifier la sortie sur le Mac de présentation. Le vieux test qui écrivait dans la base de développement a été retiré ; les tests avec moteurs réels passent uniquement par le lanceur isolé. Ne pas lancer `POST /api/ml/train` sur les avis historiques pour une répétition : cela pourrait remplacer un Joblib personnel.

Pour actualiser ultérieurement les mesures agrégées **en lecture seule**, uniquement après avoir vérifié les environnements ciblés :

```sh
cd backend
node scripts/diagnosePostgres.js
node scripts/reportEvaluationQuality.js
node scripts/diagnoseMongo.js
```

`diagnoseMongo.js` contacte la base Mongo distante. L'export privé (`backend/scripts/exportEvaluationDataset.js`) crée un JSON de préférences individuelles hors Git et les scripts `ml-service/evaluate.py`, `evaluate_robust.py` et `audit_final_ml.py` l'analysent sans entraîner les Joblib applicatifs. La procédure et les limites sont dans la [fiche C2](preuves/C2_MODELE.md). Ne publier que les agrégats autorisés ; les nouvelles métriques remplacent les chiffres datés uniquement avec leur protocole et leur population.

## Activation locale des corrections et cycle de vie

Les tests utilisent leurs propres processus. Pour essayer **l'application existante**, arrêter normalement les anciens Node/Python depuis leurs terminaux, puis redémarrer le backend (`cd backend`, `npm run dev`) et recharger Expo. Pour Python, le lancement suivant reprend les variables du `.env` backend **sans afficher le secret**, avec un seul worker ; vérifier que le port 8000 est libre avant lancement :

```sh
# Depuis backend, dans un autre terminal
ML_PYTHON=/opt/anaconda3/bin/python3 node - <<'JS'
require('dotenv').config({ quiet: true });
const { spawn } = require('node:child_process');
const child = spawn(process.env.ML_PYTHON, [
  '-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8000', '--workers', '1'
], { cwd: '../ml-service', env: process.env, stdio: 'inherit' });
child.on('error', () => { console.error('Démarrage Python impossible'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
JS
```

Vérifier ensuite la connexion, les photos du dressing, l'aperçu de modification, les images de la tenue et les boutons avec VoiceOver si disponible. Les anciennes URL `/uploads` demandent maintenant l'authentification : les ouvrir directement dans un navigateur sans JWT doit donner `401`. Les images du compte connecté doivent rester visibles dans l'application mise à jour. À 9 °C, une couche extérieure disponible doit apparaître ; les lunettes de soleil ne sont proposées que pour un code météo `01d` ou `02d`. Ces règles sont aussi testées avec des données fictives ; vérifier leur rendu sur l'appareil. Un ancien client ne transmettant pas ces en-têtes ou le code météo ne convient plus à la démonstration complète. Un vote manuel écrit un avis et peut réentraîner le modèle de ce compte ; utiliser un compte de test prévu pour cette session.

**Exploitation C3 retenue, pas encore exécutée sur les données réelles :**

- Journal de diagnostic : 30 jours. `node scripts/retainLogs.js` donne un **aperçu en lecture seule**, sur le Mongo défini dans `.env` (actuellement distant). `--apply` est une purge explicite ; ne l'exécuter qu'après contrôle de la cible et validation de son inventaire. Planifier ce contrôle quotidien lors de l'exploitation ; aucun cron ni TTL n'est installé par ce travail.
- Suppression partielle : contrôler les manifestes privés, puis `node scripts/retryAccountDeletionCleanup.js` reprend les effacements en attente. Cette commande est **destructive** sur les ressources du compte concerné, contrairement à un diagnostic.
- Sauvegardes : inventaire privé avec date de création/expiration, rétention maximale proposée 30 jours, accès restreint et chiffrement avant transfert. Une copie manuelle oubliée n'expire pas toute seule ; sa suppression doit être opérée et tracée. Aucune sauvegarde réelle n'a été modifiée ici.
- Avant restauration : isoler la cible du mobile, préserver le registre courant `backend/private/deletion-jobs` et les marqueurs Python `*.deleted` hors de l'ancienne sauvegarde, restaurer en copie, puis lancer `node scripts/checkRestoration.js`. `blocked` signifie qu'un compte effacé a été réintroduit ; `no_receipts` ne permet pas de conclure à l'absence de suppressions passées ; `sql_clear` ne valide **que SQL**. Vérifier également Mongo, images et Joblib avant remise en service. Ne pas réinitialiser les séquences pour réutiliser des identifiants supprimés.
- Conserver les reçus et marqueurs tant qu'une ancienne sauvegarde peut réintroduire les comptes effacés. Les retirer seulement après inventaire des copies expirées et clôture des tâches ; aucune purge automatique de ce registre n'est prévue.

Les tests prouvent la suppression entre les quatre stockages et la restauration **PostgreSQL** avec blocage du compte ressuscité. Ils ne prouvent pas une restauration complète des quatre stockages ni un effacement des anciennes images dans l'historique Git. L'accès et le cycle de vie du Mongo distant doivent aussi être vérifiés par son responsable.

## Test de 2–3 volontaires : protocole encore sans résultats

Le besoin confirmé est **temps gagné + découverte + réutilisation du dressing**. Fixer le protocole avant la première session et conserver tous les résultats, y compris les échecs. Un petit test d'usage n'est ni une mesure de précision ML ni une preuve de représentativité.

1. Avant toute suggestion, chaque personne désigne les vêtements du dressing fictif qu'elle oublie facilement et explique ce qu'elle accepterait de porter dans la situation donnée. Pour un dressing entièrement inconnu, noter « réutilisation non mesurable ».
2. Faire deux tâches comparables à température et contraintes fixées : choisir une tenue comme d'habitude depuis le dressing, puis choisir avec FITS. Inverser l'ordre pour le participant suivant ; utiliser une deuxième situation comparable pour limiter la mémorisation. Noter la différence de difficulté et l'effet d'ordre comme limites.
3. Chronométrer jusqu'à **une tenue jugée acceptable**, avec un plafond fixé à **trois minutes et cinq suggestions FITS**. À la limite, noter « aucun choix acceptable » et le temps consommé ; ne pas l'éliminer de la comparaison. Si une aide est donnée ou une panne survient, la consigner séparément.
4. Pour chaque suggestion effectivement vue, relever « acceptable ? », « intéressante et nouvelle pour toi ? », « contient un vêtement déclaré oublié ? ». Laisser les votes exprimer les vrais goûts, sans équilibrer artificiellement les classes.
5. Rapporter les observations par participant : temps et différence descriptive, acceptations/tentatives, nouveautés utiles/propositions vues, tenues acceptées réutilisant un vêtement oublié. Avec deux ou trois personnes, ne pas annoncer de gain général ni de significativité.

| Participant | Choix habituel : durée / accepté ? | FITS : durée / accepté ? / suggestions | Nouvelles et utiles / vues | Acceptées avec vêtement oublié | Ordre, aide, incident, commentaire |
|---|---|---|---|---|---|
| P1 | Non mesuré | Non mesuré | Non mesuré | Non mesuré | À remplir après essai |
| P2 | Non mesuré | Non mesuré | Non mesuré | Non mesuré | À remplir après essai |
| P3 | Non mesuré | Non mesuré | Non mesuré | Non mesuré | À remplir après essai |

**Critères décidés avant collecte :** aucun accès à un autre compte ni perte d'avis ; toutes les tâches tentées rapportées ; un gain de temps n'est annoncé que pour les participants chez qui il est observé, à choix acceptable ; nouveauté et réutilisation restent des déclarations, pas des faits inférés du modèle. Ne pas diminuer ces exigences pour obtenir un résultat favorable.

Chaque personne doit avoir **un compte distinct** et, si possible, le même petit dressing fictif et la même température. Vérifier d'abord que les bases configurées sont bien des environnements de test et sauvegarder les données de développement si des comptes/votes seront créés : ces actions écrivent en SQL/Mongo et un avis peut réentraîner le modèle de ce compte. Noter appareil, version et incidents réseau/météo. Recueillir l'accord pour une synthèse anonyme : P1, P2, P3 ; aucun nom, e-mail, IP, JWT, image personnelle ou citation directe sans accord.

Donner sans guidage les trois mêmes tâches : **ajouter un vêtement fictif ; générer une tenue et expliquer le résultat ; rejeter la tenue et demander une autre proposition**. Pour chaque tâche, relever réussite sans aide, durée, blocages et messages d'erreur. Poser ensuite : « Qu'est-ce qui t'a aidé ? », « Qu'est-ce qui t'a gêné ? », « Utiliserais-tu cette proposition dans une situation réelle, et pourquoi ? »

| Participant | Date / appareil / conditions | Ajout : réussite / temps | Génération : réussite / temps | Rejet : réussite / temps | Incidents et retour libre |
|---|---|---|---|---|---|
| P1 | À remplir | À remplir | À remplir | À remplir | À remplir |
| P2 | À remplir | À remplir | À remplir | À remplir | À remplir |
| P3, si disponible | À remplir | À remplir | À remplir | À remplir | À remplir |

Rapporter le nombre de tâches réussies **sur celles effectivement tentées** et garder les pannes. Avec peu de personnes, présenter des observations individuelles anonymisées, pas une représentativité ni une accuracy ML. Garder les 69 avis historiques séparés de la nouvelle cohorte : les votes étaient parfois aléatoires, les anciennes tenues ont pu être sélectionnées par une version précédente du générateur et 66 avis manquent de snapshot. Le candidat peut aussi créer son nouveau compte, distinct des volontaires. Noter date et révision du code pour chaque session, puis voter selon une préférence réellement ressentie, sans forcer artificiellement un équilibre likes/dislikes. Pour chaque nouveau compte, résumer séparément avis bruts, likes/dislikes, températures et snapshots valides, lignes exploitables et groupes distincts. Le seuil d'entraînement 20 avis / cinq par classe n'est **pas** un seuil de preuve prédictive. S'il manque des groupes indépendants pour un test fixé à l'avance, écrire « métriques prédictives non fiables / non calculées ». Les retours d'usage ne mesurent pas le classement des cinq candidats non présentés.

## Répétition sur le réseau de l’oral

La [trame de huit diapositives et les réponses aux questions](SOUTENANCE.md) sont dans un document séparé. Si le téléphone ou le réseau local échoue, montrer la sortie vérifiée de `ml-service/demo_isolated.py` et les graphiques sans lancer d’entraînement réel sous stress. Le mobile utilise encore une IP LAN fixe dans `mobile/src/services/api.js` : relever l’adresse du Mac sur le réseau utilisé, adapter cette configuration, puis vérifier connexion, images et génération avant l’oral. Le backend charge `backend/.env` ; Python reçoit `ML_SERVICE_SECRET` de son processus. Les deux valeurs doivent coïncider sans être affichées. Vérifier PostgreSQL, MongoDB, Python, Node et la météo. Les votes manuels écrivent des avis et peuvent réentraîner le modèle du compte : utiliser un compte de démonstration prévu pour cela.

**Contrôle technique rapide sur le Mac, sans vote ni entraînement :** depuis la racine du dépôt, exécuter les commandes ci-dessous dans le Terminal. `pg_isready` vérifie PostgreSQL ; les deux `curl` interrogent des pages publiques locales sans toucher aux modèles. Si un test échoue, démarrer le service concerné puis le relancer. Enfin, comparer l'adresse `API_URL` affichée avec l'adresse IPv4 actuelle du Mac sur le réseau utilisé par le téléphone ; l'accès au backend depuis le téléphone reste à essayer manuellement. Ne pas ouvrir `.env` devant le jury.

```sh
pg_isready -h 127.0.0.1 -p 5432
curl -fsS http://127.0.0.1:3002/api-docs/ >/dev/null && echo 'API Node joignable'
curl -fsS http://127.0.0.1:8000/openapi.json >/dev/null && echo 'Service Python joignable'
rg -n 'const API_URL' mobile/src/services/api.js
ifconfig | rg 'inet '
```

Ces vérifications établissent la disponibilité des ports locaux et la cohérence probable de l'adresse mobile ; elles ne prouvent ni la communication authentifiée Node↔Python, ni le fonctionnement météo/Mongo, ni l'accès depuis le téléphone. Pour ces points, jouer le parcours réel une fois avant l'oral sur un compte de démo, après sauvegarde et vérification de l'environnement.

**Contrôle effectué le 13/10/2026 vers 19:57 UTC depuis le Mac :** PostgreSQL local acceptait les connexions ; `/api-docs/` côté Node et `/openapi.json` côté Python répondaient chacun HTTP 200. Ce constat est local et daté ; il faudra le refaire sur le réseau de l'oral.

**Avant remise :** confirmer le code du bloc avec l’établissement, vérifier que le dépôt et les fixtures fictives sont accessibles au jury, puis ajouter uniquement les retours utilisateurs réellement recueillis aux fiches de preuves. Les questions et réponses sont dans [SOUTENANCE.md](SOUTENANCE.md).
