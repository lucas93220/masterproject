# FITS — Préparation pratique de la soutenance

Ce guide regroupe les preuves à montrer, la démo sans données réelles, les tests utilisateurs à faire et la trame orale. Les faits et métriques sont dans [ETAT_ACTUEL.md](ETAT_ACTUEL.md) ; le [REX individuel](DOSSIER_REX_E7B.md) doit être relu et personnalisé avant remise. Ne montrer ni `.env`, JWT, secret ML, e-mail, export individuel, ni photographie privée.

## Preuves par compétence

| Axe | Pièce à montrer | Phrase juste et limite |
|---|---|---|
| C1 — besoin/3V | Schéma sources et mesures d'`ETAT_ACTUEL.md`, `backend/scripts/diagnosePostgres.js` | Prototype défini par le candidat ; variété réelle, volume/vélocité massifs non constatés ; retour utilisateur encore absent. |
| C2 — conception/évaluation ML | `ml-service/evaluate_robust.py`, `audit_final_ml.py`, graphique ci-dessous | Modèle personnel fonctionnel, RF 0,582 contre majorité 0,638 sur 30 splits recouvrants d'un compte ; gain prédictif et classement des cinq candidats non démontrés. |
| C3 — ETL/qualité/protection | `backend/services/trainingDataset.js`, `evaluationController.js`, graphique ci-dessous | 69 avis → 64 lignes, cinq exclusions, trois snapshots valides ; protection et suppression inter-stockages incomplètes. |
| C4 — bases de données | Diagramme et plans SQL d'`ETAT_ACTUEL.md`, `backend/scripts/diagnosePostgres.js` | Clés/FK/JSONB adaptés ; scans rapides sur petites tables, aucun gain d'index démontré. |
| C5 — programme IA | `backend/tests/mlJourney.integration.test.js`, `ml-service/demo_isolated.py` | Identité par JWT, Joblib par utilisateur et fallback ; démo synthétique ≠ performance réelle. |

![Passage des avis dans l'ETL : chiffres agrégés locaux du 13/10/2026](visuels/qualite_avis.png)

Le premier visuel porte sur **69 avis bruts** pour les exclusions et snapshots, mais sur **64 lignes** pour les 42 likes/22 dislikes. La provenance des avis et leur représentativité restent à confirmer.

![Random Forest et baseline sur 30 séparations groupées recouvrantes d'un compte local](visuels/accuracy_rf_baseline.png)

Les moustaches indiquent un **écart-type descriptif**, pas un intervalle de confiance. Le RF ne gagne aucun des 30 comparatifs appariés. Ces chiffres ne décrivent pas la performance de l'application en production.

## Démo isolée et tests sûrs

Depuis la racine du dépôt, les commandes suivantes n'écrivent ni dans PostgreSQL ni dans les Joblib de l'application. Installer les dépendances du projet dans un environnement isolé si nécessaire ; `ml-service/requirements.txt` décrit les versions directes. `demo_isolated.py` utilise un secret fictif, 30 lignes synthétiques et un dossier temporaire.

```sh
cd ml-service
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 python3 demo_isolated.py
```

Sortie attendue observée le 13/10/2026 : `train_status: model trained`, `meme_utilisateur: personalized`, `autre_utilisateur: fallback`, `raison_fallback: no_model`. Vérifier à nouveau la sortie sur le Mac de présentation. Pour la partie Node, lancer les tests ciblés de `backend/tests` **en excluant `fits.test.js`**, qui écrit dans la base de développement. Les tests mobile sont dans `mobile/tests`. Ne pas lancer `POST /api/ml/train` sur les avis historiques pour une répétition : cela pourrait remplacer un Joblib personnel.

Pour actualiser ultérieurement les mesures agrégées **en lecture seule**, uniquement après avoir vérifié les environnements ciblés :

```sh
cd backend
node scripts/diagnosePostgres.js
node scripts/reportEvaluationQuality.js
node scripts/diagnoseMongo.js
```

`diagnoseMongo.js` contacte la base Mongo distante. L'export privé (`backend/scripts/exportEvaluationDataset.js`) crée un JSON de préférences individuelles hors Git et les scripts `ml-service/evaluate.py`, `evaluate_robust.py` et `audit_final_ml.py` l'analysent sans entraîner les Joblib applicatifs. La procédure détaillée, les garde-fous et le format sont dans `ml-service/EVALUATION.md`. Ne publier que les agrégats autorisés ; les nouvelles métriques remplacent les chiffres datés uniquement avec leur protocole et leur population.

## Test de 2–3 volontaires : protocole encore sans résultats

Chaque personne doit avoir **un compte distinct** et, si possible, le même petit dressing fictif et la même température. Vérifier d'abord que les bases configurées sont bien des environnements de test et sauvegarder les données de développement si des comptes/votes seront créés : ces actions écrivent en SQL/Mongo et un avis peut réentraîner le modèle de ce compte. Noter appareil, version et incidents réseau/météo. Recueillir l'accord pour une synthèse anonyme : P1, P2, P3 ; aucun nom, e-mail, IP, JWT, image personnelle ou citation directe sans accord.

Donner sans guidage les trois mêmes tâches : **ajouter un vêtement fictif ; générer une tenue et expliquer le résultat ; rejeter la tenue et demander une autre proposition**. Pour chaque tâche, relever réussite sans aide, durée, blocages et messages d'erreur. Poser ensuite : « Qu'est-ce qui t'a aidé ? », « Qu'est-ce qui t'a gêné ? », « Utiliserais-tu cette proposition dans une situation réelle, et pourquoi ? »

| Participant | Date / appareil / conditions | Ajout : réussite / temps | Génération : réussite / temps | Rejet : réussite / temps | Incidents et retour libre |
|---|---|---|---|---|---|
| P1 | À remplir | À remplir | À remplir | À remplir | À remplir |
| P2 | À remplir | À remplir | À remplir | À remplir | À remplir |
| P3, si disponible | À remplir | À remplir | À remplir | À remplir | À remplir |

Rapporter le nombre de tâches réussies **sur celles effectivement tentées** et garder les pannes. Avec peu de personnes, présenter des observations individuelles anonymisées, pas une représentativité ni une accuracy ML. Garder les 69 avis historiques séparés de la nouvelle cohorte ; les anciennes tenues ont pu être sélectionnées par une version précédente et 66 avis manquent de snapshot. Pour chaque nouveau compte, résumer séparément avis bruts, likes/dislikes, températures et snapshots valides, lignes exploitables et groupes distincts. Le seuil d'entraînement 20 avis / cinq par classe n'est **pas** un seuil de preuve prédictive. S'il manque des groupes indépendants pour un test fixé à l'avance, écrire « métriques prédictives non fiables / non calculées ». Les retours d'usage ne mesurent pas le classement des cinq candidats non présentés.

## Trame de huit diapositives, dix minutes maximum

| Diapo | Preuve et message |
|---|---|
| 1. Problème | FITS choisit une tenue plausible à partir de météo, dressing et préférences ; projet personnel, prototype local. |
| 2. Sources / 3V | Schéma du parcours ; 271 tenues, 69 avis, 233 logs. Variété observée, Big Data massif absent. |
| 3. ETL / qualité | Visuel 69 → 64, cinq exclus, 42/22, trois snapshots ; risque historique. |
| 4. C4 | Schéma SQL, JSONB, `Seq Scan` de 69 avis en 0,017 ms côté serveur ; aucun index ajouté sans mesure. |
| 5. Programme d'IA | Cinq candidats, `outfit-v2`, modèle par utilisateur ou fallback, vote puis snapshot ; démo isolée si utile. |
| 6. Résultat ML | Visuel RF 58,2 % < majorité 63,8 %, 29 vecteurs, un compte, 30 splits recouvrants ; aucun gain démontré. |
| 7. Sécurité et limites | JWT, uploads contrôlés, nouveaux logs minimisés ; images disque publiques et suppression transversale absente. |
| 8. Décision | Fonctionnement établi, valeur du classement non mesurée ; prochaines preuves : retours authentiques, avis diversifiés avec snapshots, protocole de classement. |

Prévoir une **sortie de secours** si le téléphone ou le réseau local échoue : ne pas lancer un entraînement réel sous stress ; montrer la sortie vérifiée de `demo_isolated.py` et les graphiques. Le mobile utilise encore une IP LAN fixe dans `mobile/src/services/api.js` : sur un autre réseau, relever l'IP du Mac, adapter la configuration et tester connexion/image/génération avant l'oral. Le backend charge `backend/.env` ; Python lit `ML_SERVICE_SECRET` de son environnement de processus. Leurs valeurs doivent être identiques sans être affichées. Vérifier que PostgreSQL, Mongo, Python, Node et la météo sont joignables. Les tests manuels du parcours créent des données et peuvent réentraîner le modèle du compte : les faire sur un environnement de test préparé.

## Réponses courtes aux objections probables

- **Pourquoi le RF sous la baseline ?** Peu de données d'un compte, 29 vecteurs distincts, des labels contradictoires et 66 snapshots absents. C'est un constat, pas une cause prouvée individuellement.
- **Aucune fuite ?** Le protocole sépare tenue et vecteur identiques. Le partage de vêtements et la reconstruction de l'historique laissent d'autres risques ; ne pas revendiquer une absence absolue de fuite.
- **Qualité du classement des cinq tenues ?** Non mesurée : seul le candidat affiché reçoit un avis. AUC des avis exposés n'est pas NDCG@5.
- **Pourquoi conserver le RF ?** C'est le modèle de référence technique ; les mêmes avis ne constituent pas un jeu indépendant justifiant son remplacement. La personnalisation reste expérimentale.
- **Pourquoi PostgreSQL et Mongo ?** SQL assure relations/transactions du métier ; Mongo héberge logs et voie photo mais n'apporte aucun gain ML observé à ce volume et complique la suppression.
- **FITS est-il conforme RGPD ?** Non démontré : accès aux images disque, rétention et suppression entre stockages restent incomplets.
- **Quels retours clients ?** Aucun à ce jour ; les votes du compte test sont des labels, pas une étude utilisateur. Le protocole des volontaires est prêt, sans résultat inventé.
- **Où est le jeu réel sur Git ?** Il n'y est pas : les préférences individuelles restent dans un export privé. Code et exemples synthétiques sont reproductibles ; une diffusion anonymisée demanderait une revue de confidentialité.
- **Qu'est-ce qui est effectivement rapide ?** Quelques lectures SQL et une prédiction Python locale. Latence complète, charge et SLA n'ont pas été mesurés.

**Avant remise :** confirmer avec l'établissement le code du bloc dans sa grille validée, relire les contributions personnelles et la provenance des avis dans le REX, puis insérer uniquement les retours utilisateurs réellement recueillis. Aucune note diagnostique sur 20 n'est une décision du jury.
