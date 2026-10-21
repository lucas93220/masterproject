# FITS — Préparation de la soutenance RNCP bloc 4

Ce guide correspond au **fonctionnement courant** décrit dans [l'état actuel](ETAT_ACTUEL.md) : modèle personnel **articles/paires pour tous les comptes**, Random Forest conservé comme **référence comparative**. Les pièces détaillées sont [C1](preuves/C1_BESOIN.md), [C2](preuves/C2_MODELE.md), [C3](preuves/C3_DONNEES.md), [C4](preuves/C4_STOCKAGE.md) et [C5](preuves/C5_PROGRAMME.md). La grille fournie et validée par l'établissement décide « valide / non valide » pour chaque axe ; aucun dossier REX séparé n'est demandé selon le candidat.

Ne montrer au jury ni `.env`, JWT, secret ML, e-mail, photographie privée, export de préférences individuelles ou identifiant de vêtement d'un compte réel. **Dernier relevé local en lecture seule, le 21/10/2026 à 20:25 UTC : 657 tenues, 433 avis dont 362 sur le compte récent ; 251 snapshots v2 pour l'étude du modèle courant.** Les graphiques historiques et le benchmark fictif portent leur population et leur date : ne pas les faire passer pour les performances du modèle courant.

## Ce qu'il faut montrer par axe

| Axe | Pièce et phrase défendable | Ce qui manque |
|---|---|---|
| **C1** | Besoin personnel, parcours et 3V ; auto-essai du concepteur comme estimation. | Retours indépendants de 2–3 volontaires et gain de temps chronométré. |
| **C2** | Sur le même test hors ligne de 63 avis : **42,9 % d'accuracy articles/paires contre 28,6 % RF v2 et 22,2 % majorité apprise** ; les sessions réelles montrent **40,3 % puis 66,0 %** de likes, comparaison descriptive seulement. | Une cohorte future indépendante et des jugements sur plusieurs candidats d'un même lot. |
| **C3** | **367 snapshots valides sur 433 avis**, dont 251 v2 ; ETL par compte, cinq températures historiques exclues, suppression testée sur stockages temporaires. | 66 anciens snapshots absents, sauvegardes et rétention réelle à opérer ; aucune conformité RGPD complète. |
| **C4** | Schéma SQL/JSONB, mesures sur **657 tenues réelles** et benchmark d'index à 100 000 tenues **fictives**, avec coût de 728 Kio. | Charge représentative, coût d'écriture et justification d'une migration réelle. |
| **C5** | Génération → score personnel ou fallback → avis → réentraînement ; deux utilisateurs et panne testés. | Répétition sur iPhone et réseau de l'oral ; tests techniques ≠ utilité prédictive. |

## Tests et démonstrations sans données réelles

**Après le basculement du 21/10/2026**, les suites complètes ont réussi : **179 tests backend dans 24 suites**, **51 tests Python**, **63 tests mobile dans neuf suites**, et **six scénarios d'intégration** avec PostgreSQL, MongoDB et deux FastAPI temporaires. Le pont Node → vrai Python articles/paires est inclus dans les tests backend. Le nouveau lanceur a aussi démarré les deux services sur des ports de test avec un secret fictif ; leurs pages OpenAPI ont répondu HTTP 200, puis les processus ont été arrêtés. Le lint mobile et les exports Expo web/iOS avaient réussi sur le code fusionné avant ce basculement ; aucun écran mobile n'a changé depuis. Ces vérifications prouvent le logiciel sur fixtures, pas la performance réelle des recommandations ni le rendu final sur iPhone.

Pour les tests locaux, `backend/jest.config.js` écarte les anciens tests dangereux par défaut. Depuis `backend` :

```sh
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm test -- --runInBand
```

La suite complète de fixtures demande `initdb`, `pg_ctl`, `pg_dump`, `pg_restore` et un binaire `mongod` de test, puis démarre **un PostgreSQL, un MongoDB et deux FastAPI temporaires** sans lire le `.env` applicatif :

```sh
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 FITS_TEST_MONGOD=/chemin/vers/mongod npm run test:isolated
```

Le téléchargement facultatif du binaire Mongo est décrit dans [prepareMongoTestTool.py](../../backend/scripts/prepareMongoTestTool.py) ; le lanceur vérifie la cible et utilise des dossiers sous `/private/tmp`. Il n'est pas nécessaire de télécharger quoi que ce soit pendant l'oral. Les tests mobile depuis `mobile` utilisent Jest du backend :

```sh
../backend/node_modules/.bin/jest --runInBand tests
npm run lint
```

Depuis `ml-service`, les démonstrations suivantes utilisent **des données synthétiques et des dossiers temporaires** ; elles ne modifient aucun compte réel ni Joblib applicatif :

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_interactions.py
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_isolated.py
```

La première montre deux préférences d'associations opposées et un fallback ; la seconde prouve le parcours RF de référence et son isolation. Ne pas présenter leurs scores comme une mesure de performance réelle. Ne pas appeler manuellement `POST /api/ml/train` sur les avis réels pour une simple répétition : cela peut remplacer le modèle articles/paires du compte.

## Démonstration et contrôle du réseau

Avant la répétition, vérifier quelle base PostgreSQL, quel MongoDB et quel dossier de modèles sont configurés. Démarrer les services dans trois terminaux, depuis leurs dossiers respectifs :

```sh
# Terminal 1, depuis backend : RF 8000 + modèle courant articles/paires 8001
ML_PYTHON=/opt/anaconda3/bin/python3 npm run ml:services

# Terminal 2, depuis backend
npm run dev

# Terminal 3, depuis mobile
npm run start -- --clear
```

Le lanceur lit le secret commun depuis `backend/.env` sans l'afficher. Il utilise par défaut `~/.fits/models/items-pairs-v1`. Sur **ce Mac**, le Joblib articles/paires du compte de test a été **copié sans écraser l'original** depuis `/private/tmp` dans ce dossier, puis la copie a été vérifiée identique ; il n'est pas suivi par Git. Sur un autre Mac ou si ce dossier est absent, préciser `ML_EXPERIMENTAL_MODELS_DIR` vers un stockage privé existant ou accepter un premier `fallback/no_model` avant réentraînement. Le port 8000 garde les anciens Joblib RF pour leur suppression, mais ne classe plus les tenues. Le port 8001 est indispensable au score courant. Le backend et la météo requièrent aussi PostgreSQL et MongoDB joignables.

Vérifications en lecture seule depuis le Mac :

```sh
pg_isready -h 127.0.0.1 -p 5432
curl -fsS http://127.0.0.1:3002/api-docs/ >/dev/null && echo 'Node joignable'
curl -fsS http://127.0.0.1:8000/openapi.json >/dev/null && echo 'RF de référence joignable'
curl -fsS http://127.0.0.1:8001/openapi.json >/dev/null && echo 'Articles/paires joignable'
```

Ces quatre contrôles ne prouvent ni les en-têtes secrets, ni Mongo/météo, ni l'accès depuis l'iPhone. En LAN, le mobile utilise l'hôte annoncé par Expo sur le port 3002 ; au changement de réseau, redémarrer Expo. Si nécessaire, configurer `EXPO_PUBLIC_API_URL` dans `mobile/.env.local` puis relancer Expo. Tester depuis **le téléphone** la connexion, les images privées, la recherche/édition du dressing, la génération et un vote sur un **compte de démonstration prévu pour écrire des avis**. La réponse de génération doit indiquer `model_used: personalized` et `model_variant: items-pairs-v1` si son modèle est disponible ; `fallback/no_model` est normal pour un compte encore insuffisamment alimenté. Ne pas afficher de JWT devant le jury.

Une compilation Expo fraîche et les tests mobile passaient avant ce basculement. Si `TYPE.eyebrow` ou `TYPE.caption` réapparaît dans un ancien client, fermer complètement l'application et redémarrer Metro avec `npm run start -- --clear`, puis **vérifier sur l'appareil** ; ce diagnostic de cache n'est pas une validation manuelle déjà obtenue. Si réseau, météo ou ML échouent pendant l'oral, utiliser la sortie vérifiée des démos synthétiques et les preuves datées, sans lancer d'entraînement réel sous stress.

## Essais de volontaires

Aucun retour externe n'est encore documenté. Utiliser **un compte distinct par personne**, un petit dressing fictif comparable et une situation météo connue. Noter date, appareil et version. Fixer le protocole avant les premières sessions et conserver les échecs.

1. Faire choisir une tenue acceptable sans FITS, puis avec FITS ; inverser l'ordre pour la personne suivante. Chronométrer les deux tâches jusqu'au premier choix acceptable, avec plafond **3 min et 5 suggestions FITS**. Noter explicitement tout choix non obtenu.
2. Demander avant la suggestion quels vêtements du dressing sont facilement oubliés ; si le dressing est inconnu, noter « réutilisation non mesurable ».
3. Pour chaque suggestion vue, relever « acceptable ? », « nouvelle et utile ? », « contient un vêtement oublié déclaré ? ». Laisser les votes refléter de vrais goûts, sans équilibrer les classes.
4. Demander sans guider d'ajouter une pièce fictive, de retrouver une pièce avec les filtres et de générer/rejeter une tenue ; relever réussite, durée, aide et incident. Demander enfin ce qui aide ou gêne.

| Participant | Sans FITS : durée / acceptable | Avec FITS : durée / nombre vu / acceptable | Nouvelles et utiles / vues | Vêtement oublié accepté | Tâches, aide, incident |
|---|---|---|---|---|---|
| P1 | À mesurer | À mesurer | À mesurer | À mesurer | À noter |
| P2 | À mesurer | À mesurer | À mesurer | À mesurer | À noter |
| P3, si possible | À mesurer | À mesurer | À mesurer | À mesurer | À noter |

Recueillir l'accord pour une synthèse **anonyme**, sans e-mail, nom, image personnelle ou citation directe non autorisée. Deux ou trois personnes donnent des retours d'usage, **pas** une accuracy, une preuve de représentativité ou un gain statistiquement généralisable. L'auto-essai estimatif du concepteur reste séparé.

## Cycle de vie et points à vérifier

Le bouton de suppression du profil appelle un effacement coordonné de SQL, Mongo, photos attribuables et Joblib ; `202` signale une reprise nécessaire. Ne l'essayer que sur un compte fictif dédié, après avoir vérifié les environnements, car c'est une action destructive sur ce compte. Les tests isolés couvrent la reprise et le blocage après restauration SQL, pas une restauration complète des quatre stockages.

Les logs de diagnostic et les sauvegardes privées ont une rétention **proposée** de 30 jours ; aucune purge périodique réelle n'est installée. `node scripts/retainLogs.js` donne un aperçu en lecture seule ; `--apply` purge effectivement le Mongo visé. `node scripts/retryAccountDeletionCleanup.js` est également destructif pour les ressources en attente. `node scripts/checkRestoration.js` vérifie SQL en lecture seule, sans suffire à valider Mongo, photos et Joblib. Préserver les reçus de suppression et les marqueurs Python lors d'une restauration ; ne pas réutiliser les identifiants effacés. Les anciennes images non attribuables, les sauvegardes réelles et HTTP LAN restent des limites à annoncer. [Preuve C3](preuves/C3_DONNEES.md).

## Trame de huit diapositives, dix minutes

| Temps | Message et preuve |
|---:|---|
| 0:45 | **1 — C1, besoin.** Projet personnel : gagner du temps et redécouvrir son dressing. Auto-essai estimatif, aucun volontaire à ce jour. |
| 1:00 | **2 — C1, données et 3V.** Relevé local actuel : **657 tenues, 433 avis**, météo, dressing SQL, snapshots, photos/logs ; volume de prototype, pas de Big Data massif. |
| 1:15 | **3 — C3, qualité.** **367/433 snapshots valides, dont 251 v2** ; cinq températures et 66 snapshots historiques manquants. Le [visuel 69 → 64](visuels/qualite_avis.png) concerne seulement le premier relevé de l'ancien compte. |
| 1:00 | **4 — C4, stockage.** SQL relationnel + JSONB, mesures en lecture seule sur 657 tenues ; à 100 000 tenues **fictives**, requête 2,081 → 0,139 ms avec index de 728 Kio ; aucune migration réelle. |
| 1:45 | **5 — C5, programme.** Jusqu'à cinq candidats plausibles, 85 features, modèle articles/paires personnel pour tous, fallback, vote et réentraînement ; démo fictive de secours. |
| 1:30 | **6 — C2, résultats.** Montrer le [graphique du test récent](visuels/comparaison_modeles_20261021.svg) : sur les **mêmes 63 avis**, modèle courant **42,9 %**, RF v2 **28,6 %**, majorité apprise **22,2 %** d'accuracy, soit **+14,3 points face au RF**. Test unique, déséquilibré et déjà exploré. Dans l'usage du 21/10, **40,3 % puis 66,0 %** des tenues affichées ont été likées sous deux conditions différentes : indice descriptif, pas preuve causale. |
| 1:15 | **7 — C3/C5, sécurité.** Session, images privées, suppression/reprise testées en fixtures ; sauvegardes réelles et historique incomplet restent ouverts. |
| 1:30 | **8 — Décision.** Articles/paires adopté comme choix produit ; avantage prédictif général et qualité du classement non prouvés. Prochaines preuves : volontaires et cohorte future indépendante. |

## Réponses courtes aux objections

- **Pourquoi avoir adopté articles/paires malgré l'incertitude ?** Il encode enfin l'identité des vêtements voulue par le candidat et fonctionne de bout en bout. Le choix est produit ; les données actuelles ne prouvent pas qu'il battra la baseline pour d'autres comptes.
- **40,3 % contre 66,0 %, est-ce une accuracy ?** Non, c'est la part de tenues affichées aimées dans deux sessions à températures différentes. La version utilisée n'est pas enregistrée par avis ; le changement de modèle n'est pas la seule explication possible.
- **Le nouveau modèle bat-il le RF ?** **Oui sur le test chronologique hors ligne décrit**, de 42,9 % contre 28,6 % d'accuracy sur les mêmes 63 avis, soit +14,3 points. Un seul test déséquilibré et déjà exploré ne suffit pas à garantir cet écart sur de nouveaux comptes ou températures.
- **Que devient le RF ?** Référence d'évaluation et anciens Joblib conservés, pas un secours caché au classement. En absence du modèle courant : fallback au ratio de favoris.
- **Une paire rejetée est-elle bannie ?** Non. Le vote concerne toute la tenue ; le modèle apprend des associations statistiques sur plusieurs avis, et les goûts peuvent évoluer.
- **Pourquoi pas NDCG@5 ?** Seule la tenue affichée est jugée ; les quatre autres candidats n'ont pas de label.
- **La fuite est-elle éliminée ?** Les mêmes tenues, compositions et vecteurs sont purgés entre train/test dans l'essai hors ligne. Des vêtements partagés entre tenues demeurent ; aucune absence absolue de fuite n'est revendiquée.
- **RGPD et Big Data ?** Protections et suppression testées, mais historique/sauvegardes/exploitation restent ouverts. Le volume observé est un prototype, pas une infrastructure Big Data démontrée.

Avant la remise, vérifier le code exact du bloc auprès de l'établissement, la version du dépôt montrée au jury et les citations des résultats. N'ajouter que des observations de volontaires réellement recueillies.
