# FITS — Préparation pratique de la soutenance

Ce guide regroupe les commandes sûres, la démo, le protocole des volontaires et la trame orale. Les faits et métriques sont dans [l'état actuel](ETAT_ACTUEL.md) et les pièces à montrer dans les [fiches C1–C5](preuves/). Ne montrer ni `.env`, JWT, secret ML, e-mail, export individuel, ni photographie privée.

## Preuves par compétence

| Axe | Pièce à montrer | Phrase juste et limite |
|---|---|---|
| C1 — besoin/3V | [Fiche C1](preuves/C1_BESOIN.md) | Finalités définies ; auto-essai personnel estimatif documenté, effets encore non mesurés auprès de volontaires. |
| C2 — conception/évaluation ML | [Fiche C2](preuves/C2_MODELE.md) | RF sous la baseline sur les anciens relevés ; signal différent sur 82 avis v2 à 18 °C, sans généralisation démontrée. |
| C3 — ETL/qualité/protection | [Fiche C3](preuves/C3_DONNEES.md) | Snapshots et protections testés ; exploitation réelle de l'historique et des sauvegardes incomplète. |
| C4 — bases de données | [Fiche C4](preuves/C4_STOCKAGE.md) | Index mesuré sur données fictives, sans migration réelle. |
| C5 — programme IA | [Fiche C5](preuves/C5_PROGRAMME.md) | Pipeline, isolation et fallback testés ; bénéfice métier non prouvé par ces tests. |

Les [visuels](visuels/) sont datés et décrits dans les fiches. Le graphique RF/baseline porte sur l'ancien compte ; le compte récent est documenté séparément dans C2. Ne pas mélanger leurs chiffres.

## Démo isolée et tests sûrs

**Dernière exécution complète documentée du 14/10/2026 : 222 tests réussis** : 159 backend (22 suites), six scénarios avec vrais stockages temporaires, 35 Python et 22 mobile. Lors du tri documentaire, 81 tests backend sans ouverture de port, 35 tests Python et 22 tests mobile ont été relancés avec succès ; le sandbox a refusé le port requis par la suite backend complète. Un essai intermédiaire antérieur du pont Python a atteint son délai de 60 s ; relancé seul puis dans les suites finales, il a réussi sans modification du modèle. La cause de cet incident ponctuel n'a pas été établie. Les tests n'ont pas modifié les données applicatives ; l'essai d'interactions local décrit dans la [fiche C2](preuves/C2_MODELE.md) est en lecture seule.

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

La trame de huit diapositives et les réponses aux questions figurent ci-dessous. Si le téléphone ou le réseau local échoue, montrer la sortie vérifiée de `ml-service/demo_isolated.py` et les graphiques sans lancer d’entraînement réel sous stress. En développement LAN, le mobile reprend l'hôte fourni par Expo pour appeler Node sur le port 3002 ; redémarrer Expo après un changement de réseau. Sans hôte LAN utilisable, il reste une adresse de secours locale ; `EXPO_PUBLIC_API_URL` dans `mobile/.env.local` permet de fixer explicitement l'URL complète. Vérifier connexion, images et génération depuis le téléphone avant l’oral. Le backend charge `backend/.env` ; Python reçoit `ML_SERVICE_SECRET` de son processus. Les deux valeurs doivent coïncider sans être affichées. Vérifier PostgreSQL, MongoDB, Python, Node et la météo. Les votes manuels écrivent des avis et peuvent réentraîner le modèle du compte : utiliser un compte de démonstration prévu pour cela.

**Contrôle technique rapide sur le Mac, sans vote ni entraînement :** depuis la racine du dépôt, exécuter les commandes ci-dessous dans le Terminal. `pg_isready` vérifie PostgreSQL ; les deux `curl` interrogent des pages publiques locales sans toucher aux modèles. Si un test échoue, démarrer le service concerné puis le relancer. Vérifier que l'hôte affiché par Expo correspond au réseau du téléphone et à l'adresse IPv4 actuelle du Mac ; l'accès au backend depuis le téléphone reste à essayer manuellement. Ne pas ouvrir `.env` devant le jury.

```sh
pg_isready -h 127.0.0.1 -p 5432
curl -fsS http://127.0.0.1:3002/api-docs/ >/dev/null && echo 'API Node joignable'
curl -fsS http://127.0.0.1:8000/openapi.json >/dev/null && echo 'Service Python joignable'
ifconfig | rg 'inet '
```

Ces vérifications établissent la disponibilité des ports locaux et la cohérence probable de l'adresse mobile ; elles ne prouvent ni la communication authentifiée Node↔Python, ni le fonctionnement météo/Mongo, ni l'accès depuis le téléphone. Pour ces points, jouer le parcours réel une fois avant l'oral sur un compte de démo, après sauvegarde et vérification de l'environnement.

**Contrôle effectué le 13/10/2026 vers 19:57 UTC depuis le Mac :** PostgreSQL local acceptait les connexions ; `/api-docs/` côté Node et `/openapi.json` côté Python répondaient chacun HTTP 200. Ce constat est local et daté ; il faudra le refaire sur le réseau de l'oral.

## Trame de huit diapositives, dix minutes

La grille validée demande cinq décisions « valide / non valide », sans barème officiel sur 20. Le candidat a indiqué qu'aucun dossier REX séparé n'est demandé pour son rattrapage ; conserver les preuves réparties dans les cinq fiches.

| Durée | Diapo et message à défendre |
|---:|---|
| 0:45 | 1. Besoin C1 : projet personnel pour gagner du temps, découvrir des associations et des vêtements oubliés ; [auto-essai estimatif](preuves/C1_BESOIN.md), aucun gain externe mesuré. |
| 1:00 | 2. Sources et 3V C1 : météo, dressing SQL, avis/snapshots, logs et images ; petits volumes locaux, variété réelle, aucun Big Data massif. |
| 1:15 | 3. ETL C3 : cohorte historique 69 avis → 64 lignes, cinq températures manquantes et trois snapshots valides ; présenter séparément les votes récents avec snapshots. [Visuel historique](visuels/qualite_avis.png). |
| 1:00 | 4. Stockage C4 : relations SQL et snapshot JSONB ; benchmark sur 100 000 tenues **fictives** : 2,081 → 0,139 ms, index de 728 Kio ; aucune migration réelle. |
| 1:45 | 5. Programme C5 : jusqu'à cinq candidats, 85 features, modèle personnel ou fallback, vote et snapshot ; démo isolée en secours. |
| 1:30 | 6. Résultat C2 : ancien compte RF 58,2 % contre majorité 63,8 % ; sur 82 nouveaux votes v2 à 18 °C, RF 50,2 % contre majorité 42,9 % sur 30 découpages groupés recouvrants. [C2](preuves/C2_MODELE.md) distingue les cohortes et les limites ; aucune mesure du classement des cinq candidats. |
| 1:15 | 7. Protection C3/C5 : accès privés et suppression/reprise testés avec des stockages temporaires ; sauvegardes réelles et ancien historique restent à traiter. |
| 1:30 | 8. Décision : conserver le RF comme référence expérimentale ; recueillir des retours indépendants et des avis variés, puis évaluer un protocole fixé à l'avance. |

## Réponses courtes aux questions probables

- **Pourquoi les scores du RF changent-ils ?** Les jeux et conditions diffèrent : anciens snapshots manquants, votes historiques parfois aléatoires, nouveaux avis v2 sincères mais tous à 18 °C. Les petits tests varient selon leur découpage ; aucune cause unique ni gain général n'est démontré.
- **Le modèle sert-il ?** Un modèle compatible calcule un score personnel pour classer les candidats admissibles. Son avantage prédictif et la qualité du classement présenté ne sont pas établis ; le fallback sert en absence de modèle ou en cas de panne.
- **Pourquoi ne pas promouvoir les variantes testées ?** Les mêmes petits jeux ont déjà servi aux explorations. Il faut un test indépendant fixé avant collecte pour éviter de retenir un résultat fortuit.
- **La fuite est-elle éliminée ?** Les tests séparent tenues et vecteurs identiques. Le partage de vêtements et la reconstruction des anciens avis laissent des risques résiduels.
- **Pourquoi aucune métrique de classement des cinq ?** Seule la tenue affichée reçoit un avis ; l'AUC des tenues exposées n'est pas un NDCG@5.
- **Pourquoi deux bases ?** PostgreSQL porte les relations et transactions ; MongoDB porte logs et voie photo. Son avantage à ce volume n'est pas démontré et la suppression entre stockages est plus complexe.
- **RGPD et accessibilité ?** Contrôles techniques testés, mais sauvegardes réelles, historique, revue juridique et audit d'accessibilité restent à faire. Le prototype LAN utilise HTTP.
- **Retours utilisateurs ?** Aucun retour externe documenté ; l'auto-essai du concepteur est détaillé dans C1. Ajouter seulement les observations réellement recueillies.

**Avant remise :** confirmer le code du bloc avec l’établissement (la grille validée mentionne BC04B et une cellule BC04A), vérifier que le dépôt et les fixtures fictives sont accessibles au jury, relire les contributions personnelles, puis ajouter uniquement les retours utilisateurs réellement recueillis aux fiches de preuves.
