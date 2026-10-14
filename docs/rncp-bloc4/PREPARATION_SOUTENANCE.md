# FITS — Préparation pratique de la soutenance

Ce guide regroupe les preuves à montrer, la démo sans données réelles, les tests utilisateurs à faire et la trame orale. Les faits et métriques sont dans [ETAT_ACTUEL.md](ETAT_ACTUEL.md) ; le [REX individuel](DOSSIER_REX_E7B.md) doit être relu et personnalisé avant remise. Ne montrer ni `.env`, JWT, secret ML, e-mail, export individuel, ni photographie privée.

## Preuves par compétence

| Axe | Pièce à montrer | Phrase juste et limite |
|---|---|---|
| C1 — besoin/3V | Besoin confirmé, schéma sources, mesures et protocole comparatif ci-dessous | Gagner du temps, découvrir des associations, retrouver des vêtements oubliés : finalités définies, effets encore non mesurés. |
| C2 — conception/évaluation ML | `ml-service/evaluate_robust.py`, `audit_final_ml.py`, graphique historique ci-dessous et nouveau relevé dans `ETAT_ACTUEL.md` | Ancien compte : RF 0,582 contre majorité 0,638 ; compte récent séparé : RF 0,624 contre majorité 0,659. Gain prédictif et classement des cinq candidats non démontrés. |
| C3 — ETL/qualité/protection | `trainingDataset.js`, `accountDeletion.js`, `tests/isolated/pipeline.test.js` | Nouveaux snapshots ; accès privé, effacement et rétention testés avec vrais stockages temporaires ; historique non attribuable et exploitation des sauvegardes restent à traiter. |
| C4 — bases de données | Diagramme, `benchmark_stockage_synthetique.json`, `visuels/stockage_synthetique.svg` | Index comparé avant/après sur 1 000 à 100 000 tenues fictives avec coût de stockage ; aucune migration réelle justifiée à ce jour. |
| C5 — programme IA | `tests/isolated/pipeline.test.js`, `rankCandidates.js`, `demo_isolated.py` | HTTP réel, 85 colonnes, deux modèles, panne et fallback ; fonctionnement ≠ performance réelle. |

![Passage des avis dans l'ETL : chiffres agrégés locaux du 13/10/2026](visuels/qualite_avis.png)

Le premier visuel porte sur **69 avis bruts** pour les exclusions et snapshots, mais sur **64 lignes** pour les 42 likes/22 dislikes. La provenance des avis et leur représentativité restent à confirmer.

![Random Forest et baseline sur 30 séparations groupées recouvrantes d'un compte local](visuels/accuracy_rf_baseline.png)

Les moustaches indiquent un **écart-type descriptif**, pas un intervalle de confiance. Le RF ne gagne aucun des 30 comparatifs appariés. Le candidat a indiqué avoir voté parfois assez aléatoirement ; ces chiffres ne décrivent ni ses préférences réelles ni la performance de l'application en production.

**Nouveau relevé à présenter séparément si le compte SQL 6 est bien celui du candidat :** 100 avis récents, 67 likes/33 dislikes et 100 snapshots valides. Sur 30 séparations groupées, accuracy RF **0,624 ± 0,090**, majorité **0,659 ± 0,065** ; RF supérieur sur 4/30 séparations. Les 100 avis ont tous été donnés à 19 °C. Le graphique ci-dessus reste celui de l'ancien compte et ne représente pas ces nouveaux résultats. Tableau complet, méthode et limites : `ETAT_ACTUEL.md`. Ne pas fusionner les comptes ou déduire un gain réel des valeurs les plus favorables.

## Démo isolée et tests sûrs

**Vérification finale du 14/10/2026 : 206 tests réussis** : 150 backend (22 suites), six scénarios avec vrais stockages temporaires, 29 Python et 21 mobile. Un essai intermédiaire du pont Python a atteint son délai de 60 s ; relancé seul puis dans la suite finale, il a réussi sans modification du modèle. La cause de cet incident ponctuel n'a pas été établie. Aucun test n'a ciblé les données applicatives.

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

Sortie attendue observée le 13/10/2026 : `train_status: model trained`, `meme_utilisateur: personalized`, `autre_utilisateur: fallback`, `raison_fallback: no_model`. Vérifier la sortie sur le Mac de présentation. `fits.test.js` est exclu par la configuration Jest car il écrit dans la base de développement ; ne pas contourner cette exclusion. Ne pas lancer `POST /api/ml/train` sur les avis historiques pour une répétition : cela pourrait remplacer un Joblib personnel.

Pour actualiser ultérieurement les mesures agrégées **en lecture seule**, uniquement après avoir vérifié les environnements ciblés :

```sh
cd backend
node scripts/diagnosePostgres.js
node scripts/reportEvaluationQuality.js
node scripts/diagnoseMongo.js
```

`diagnoseMongo.js` contacte la base Mongo distante. L'export privé (`backend/scripts/exportEvaluationDataset.js`) crée un JSON de préférences individuelles hors Git et les scripts `ml-service/evaluate.py`, `evaluate_robust.py` et `audit_final_ml.py` l'analysent sans entraîner les Joblib applicatifs. La procédure détaillée, les garde-fous et le format sont dans `ml-service/EVALUATION.md`. Ne publier que les agrégats autorisés ; les nouvelles métriques remplacent les chiffres datés uniquement avec leur protocole et leur population.

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

Vérifier ensuite la connexion, les photos du dressing, l'aperçu de modification, les images de la tenue et les boutons avec VoiceOver si disponible. Les anciennes URL `/uploads` demandent maintenant l'authentification : les ouvrir directement dans un navigateur sans JWT doit donner `401`. Les images du compte connecté doivent rester visibles dans l'application mise à jour. Un ancien client ne transmettant pas ces en-têtes ne convient plus. Un vote manuel écrit un avis et peut réentraîner le modèle de ce compte ; utiliser un compte de test prévu pour cette session.

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

## Trame de huit diapositives, dix minutes maximum

| Diapo | Preuve et message |
|---|---|
| 1. Problème | FITS choisit une tenue plausible à partir de météo, dressing et préférences ; projet personnel, prototype local. |
| 2. Sources / 3V | Schéma du parcours ; dernier relevé local : 385 tenues et 171 avis sur deux comptes ; mesure Mongo historique de 233 logs. Variété observée, Big Data massif absent. |
| 3. ETL / qualité | Cohortes séparées : historique initial 69 → 64, cinq exclus et trois snapshots ; compte récent 100/100 snapshots. Visuel existant limité à l'historique. |
| 4. C4 | Schéma SQL/JSONB ; benchmark fictif 100 000 tenues : 2,081 → 0,139 ms, index 728 Kio, sans migration réelle. |
| 5. Programme d'IA | Jusqu'à cinq candidats distincts après filtres thermiques et couleur simple, `outfit-v2`, modèle par utilisateur ou fallback, vote puis snapshot ; démo isolée si utile. |
| 6. Résultat ML | Ancien compte : visuel RF 58,2 % < majorité 63,8 %. Compte récent : tableau RF 62,4 % < majorité 65,9 %, 30 splits recouvrants ; aucun gain démontré. |
| 7. Sécurité et limites | Sessions vérifiées, images privées, suppression/rétention/restauration testées sur fixtures ; historique et exploitation réelle des sauvegardes restent à traiter. |
| 8. Décision | Fonctionnement établi, valeur du classement non mesurée ; prochaines preuves : retours authentiques, avis diversifiés avec snapshots, protocole de classement. |

Prévoir une **sortie de secours** si le téléphone ou le réseau local échoue : ne pas lancer un entraînement réel sous stress ; montrer la sortie vérifiée de `demo_isolated.py` et les graphiques. Le mobile utilise encore une IP LAN fixe dans `mobile/src/services/api.js` : sur un autre réseau, relever l'IP du Mac, adapter la configuration et tester connexion/image/génération avant l'oral. Le backend charge `backend/.env` ; Python lit `ML_SERVICE_SECRET` de son environnement de processus. Leurs valeurs doivent être identiques sans être affichées. Vérifier que PostgreSQL, Mongo, Python, Node et la météo sont joignables. Les tests manuels du parcours créent des données et peuvent réentraîner le modèle du compte : les faire sur un environnement de test préparé.

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

## Réponses courtes aux objections probables

- **Pourquoi le RF sous la baseline ?** Les deux cohortes restent petites et comportent des vecteurs aux labels contradictoires. L'historique a seulement 29 vecteurs distincts et 66 snapshots absents ; la cohorte récente a 100 snapshots mais une seule température (19 °C). Ce sont des limites constatées, pas la preuve d'une cause unique.
- **Aucune fuite ?** Le protocole sépare tenue et vecteur identiques. Le partage de vêtements et la reconstruction de l'historique laissent d'autres risques ; ne pas revendiquer une absence absolue de fuite.
- **Qualité du classement des cinq tenues ?** Non mesurée : seul le candidat affiché reçoit un avis. AUC des avis exposés n'est pas NDCG@5.
- **Pourquoi conserver le RF ?** C'est le modèle de référence technique ; les mêmes avis ne constituent pas un jeu indépendant justifiant son remplacement. La personnalisation reste expérimentale.
- **Pourquoi PostgreSQL et Mongo ?** SQL assure relations/transactions du métier ; Mongo héberge logs et voie photo mais n'apporte aucun gain ML observé à ce volume et complique la suppression.
- **FITS est-il conforme RGPD ?** Aucune certification revendiquée : accès privé et effacement/rétention sont testés avec vrais moteurs temporaires ; la politique doit être opérée, l'historique non attribuable et les sauvegardes restent à traiter. Le prototype LAN utilise encore HTTP.
- **Quels retours clients ?** Aucun à ce jour ; les votes du compte test sont des labels, pas une étude utilisateur. Le protocole des volontaires est prêt, sans résultat inventé.
- **Où est le jeu réel sur Git ?** Il n'y est pas : les préférences individuelles restent dans un export privé. Code et exemples synthétiques sont reproductibles ; une diffusion anonymisée demanderait une revue de confidentialité.
- **Qu'est-ce qui est effectivement rapide ?** Quelques lectures SQL et une prédiction Python locale. Latence complète, charge et SLA n'ont pas été mesurés.

**Avant remise :** confirmer avec l'établissement le code du bloc dans sa grille validée, relire les contributions personnelles et la provenance des avis dans le REX, puis insérer uniquement les retours utilisateurs réellement recueillis. Aucune note diagnostique sur 20 n'est une décision du jury.
