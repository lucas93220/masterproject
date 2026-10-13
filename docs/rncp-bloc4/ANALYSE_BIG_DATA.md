# FITS — C1 : sources, volumétrie et performances

**Position défendable : FITS est un prototype à faible volume.** L'analyse des 3V et des chemins de croissance montre une maîtrise des enjeux Big Data, sans prétendre traiter aujourd'hui des données massives. Les chiffres ci-dessous sont des **mesures du 13 octobre 2026**, pas une projection de production. La base PostgreSQL est la base locale `fits` ; la base MongoDB `fits` est **distante** et son statut développement/production reste à confirmer.

## Sources et usages réellement observés dans le code

| Source | Nature | Usage applicatif | Entrée du ML ? |
|---|---|---|---|
| PostgreSQL : `utilisateur`, `dressing`, `contenir`, `vetement`, `categorie`, `sous_categorie`, `zone` | Structurée | Compte, garde-robe, catalogue, règles de zones et températures | Oui : vêtements et catalogue deviennent des features. L'identité ne sert qu'à isoler les modèles. |
| PostgreSQL : `tenue`, `composer`, `evaluation` | Structurée, plus `feature_snapshot` JSONB semi-structuré | Tenues générées, composition, like/dislike et instantané des attributs au vote | Oui : température, composition/snapshot et label ; seuls les avis valides de l'utilisateur sont retenus. |
| MongoDB : `logs` | Documents semi-structurés | Journalisation des inscriptions et connexions ; les anciens documents peuvent contenir e-mail/IP, les nouveaux logs d'authentification n'ajoutent plus ces champs | Non. Aucun code de préparation ML ne les lit. |
| MongoDB : `photos` | Métadonnées + octets binaires BSON | Voie `POST /api/photo/upload` et `GET /api/photo/:id` | Non. Le Random Forest ne traite pas les pixels. |
| Disque local : `backend/uploads` | Images non structurées | Voie d'upload employée par le mobile ; URL conservée dans `vetement.photo` | Non. |
| OpenWeatherMap | JSON externe temporaire | Température et affichage météo ; les températures de tenue/avis sont ensuite stockées en SQL | Oui, **seulement la température** passée à la génération et conservée avec la tenue/avis ; pas le JSON météo brut. |
| Fichiers Joblib et stockage mobile | Artefacts / stockage local | Modèle par utilisateur côté Python ; jeton dans AsyncStorage côté mobile | Joblib est la sortie persistée du ML, pas une source d'avis ; le jeton n'est pas une feature. |

Le trajet des données utiles au ML est `météo + garde-robe SQL → cinq candidats → features outfit-v2 → score`, puis `tenue choisie + avis SQL → snapshot/état courant → dataset par utilisateur → Random Forest Joblib`. MongoDB ne participe **ni directement ni indirectement au calcul des features ou à l'entraînement** dans le code actuel ; il participe aux parcours d'authentification et de photos. Le mobile utilise l'upload disque (`mobile/src/services/api.js`), tandis que la voie photo Mongo est exposée par l'API mais n'est pas appelée par les écrans repérés.

## Volumétrie mesurée

`backend/scripts/diagnosePostgres.js` a compté les lignes dans une transaction `READ ONLY` sur PostgreSQL **14.20 Homebrew**, serveur local `::1`. `backend/scripts/diagnoseMongo.js` a lu uniquement les statistiques et index des collections `fits` distantes. Aucune image ni ligne métier n'a été affichée.

| Stockage | Mesure | Taille pertinente |
|---|---:|---:|
| PostgreSQL : utilisateurs / dressings / vêtements | 6 / 6 / 22 lignes | Base entière : **9 831 203 octets, soit 9,38 Mio**, catalogues et autres objets inclus |
| PostgreSQL : tenues / compositions / avis | **271 / 1 709 / 69 lignes** | `composer` : 304 Kio ; `tenue` : 72 Kio ; `evaluation` : 32 Kio, tailles totales des relations avec index/TOAST |
| PostgreSQL : dix tables métier inventoriées | 2 136 lignes cumulées | **624 Kio** au total pour ces dix relations ; ne pas confondre avec la taille de la base entière |
| MongoDB : `logs` | **233 documents** | 35 360 octets logiques ; 45 056 octets de stockage et 36 864 octets d'index |
| MongoDB : `photos` | **1 document** | 9 873 octets logiques ; 53 248 octets de stockage et 36 864 octets d'index |
| Disque `backend/uploads` | **17 fichiers**, tous suivis par Git | `du -sk` : **20 120 Kio** alloués sur ce Mac ; ce n'est pas la somme exacte des octets de contenu |

Les 69 avis viennent d'**un seul utilisateur** ; cinq températures absentes laissent **64 lignes ML**. Le rapport `QUALITE_DONNEES.md` donne les règles d'exclusion. Ces nombres mesurent la base observée, pas le nombre d'utilisateurs actifs ni une charge de production. Les photos disque occupent davantage d'espace que les dix tables métier, mais cela ne prouve pas un besoin Big Data.

## Performances et vélocité observées

Environnement : même Mac, PostgreSQL local, MongoDB distant, exécutions courtes le 13/10/2026. Les temps SQL sont les **temps d'exécution côté serveur** de cinq `EXPLAIN (ANALYZE, BUFFERS)` de `SELECT` par requête ; ils excluent le réseau, Sequelize, Express et le mobile. Voir `ANALYSE_POSTGRESQL.md` pour chaque requête et son plan.

| Mesure | Exécutions | Résultat |
|---|---:|---:|
| Préparation du dataset (catalogue + `buildTrainingDataset`, 64 lignes), sans démarrage ni export JSON | 3 exports privés successifs, lecture seule | **19,303 ; 16,367 ; 14,701 ms**, médiane **16,367 ms** |
| Fonction Python `predict` personnalisée, chargeant le Joblib à chaque appel, sans HTTP ni génération | 5 appels sur un vecteur issu de l'export privé | **5,724 à 9,411 ms**, médiane **5,859 ms** |
| MongoDB : recherche d'une photo par `_id`, projection `_id` uniquement, sans octets d'image | 5 lectures à distance | **7,377 à 142,042 ms**, médiane **8,232 ms** ; pic réseau notable, aucun temps de téléchargement mesuré |
| Génération complète d'une tenue | 0 | **Non mesurée** : l'endpoint crée une tenue et ses compositions en SQL ; l'appeler contre la base actuelle violerait la contrainte sans écriture. |
| Réentraînement déclenché par un avis | 0 | **Non mesuré** : il pourrait remplacer un Joblib existant. Les temps ci-dessus ne représentent pas cette opération. |

Les dates SQL montrent **271 tenues sur 11 jours ayant au moins une génération** entre le 10/03 et le 13/10/2026, avec au plus **59 tenues un jour observé** ; **69 avis sur huit jours actifs**, au plus **27 avis un jour observé**. Ces pics reflètent vraisemblablement des sessions de test et ne mesurent ni débit par seconde, ni trafic futur. Le code enchaîne jusqu'à cinq appels ML pour une génération, puis écrit la tenue ; un avis lance un réentraînement synchrone avant la réponse. Une panne ou latence des services peut donc peser sur le parcours utilisateur, sans que l'on dispose d'un P95 en production.

## Les 3V : constat, puis scénario de croissance

| Dimension | Observé | Si FITS grandit : risque et réponse proportionnée |
|---|---|---|
| **Volume** | Quelques centaines de tenues, 69 avis, 233 logs ; fichiers disque plus lourds que le SQL | `tenue` et `composer` croissent à chaque génération, `evaluation` avec les votes, `logs` avec les connexions, images avec les vêtements. Suivre tailles et rétention ; envisager pagination et stockage d'images géré quand la croissance est réelle. |
| **Vélocité** | Quelques jours d'activité concentrée ; pas de flux continu prouvé | Les cinq prédictions séquentielles et le réentraînement après avis peuvent dégrader la latence. Instrumenter temps bout en bout et taux d'erreur ; envisager un réentraînement asynchrone **si** cette latence devient gênante. |
| **Variété** | Relations SQL, JSONB de snapshot, documents Mongo, images, réponse météo JSON | Garder les contrats de features et la version du catalogue ; surveiller valeurs inconnues et couverture des snapshots. Aucun moteur distribué n'est justifié à cette échelle. |

**Stratégie progressive.** Mesurer d'abord latence, erreurs, taille des relations et croissance par jour. Si les listes grossissent, paginer les endpoints concernés ; si `EXPLAIN` montre des filtres par utilisateur coûteux sur une copie isolée, tester des index avant une migration. Mettre en cache seulement les lectures stables dont le coût est établi, par exemple le catalogue de zones/catégories. Si les avis ralentissent, découpler le réentraînement de la réponse et tracer ses échecs. Fixer une durée de conservation et un mécanisme de suppression pour logs, photos et Joblib avant croissance. PostgreSQL local et MongoDB distant n'offrent ici ni preuve de capacité horizontale ni test de charge : **Spark, Hadoop ou Kafka n'apporteraient aucune réponse à une limite mesurée**.

## Reproduction et preuve orale

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/backend'
node scripts/diagnosePostgres.js
node scripts/diagnoseMongo.js
node scripts/reportEvaluationQuality.js
du -sk uploads
git ls-files uploads | wc -l
```

Pour mesurer le dataset, exporter **un seul compte de test** dans un dossier privé hors dépôt avec `scripts/exportEvaluationDataset.js` (procédure dans `DEMO_ML.md`) : la durée de préparation est maintenant imprimée. Exécuter ensuite `PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 ml-service/diagnose_prediction.py --input <export-prive.json>` depuis la racine, puis supprimer l'export. Ce dernier script charge le Joblib existant **en lecture seule** et refuse de publier un temps si le modèle personnalisé n'est pas compatible. Ne pas diffuser le JSON, l'identifiant, le secret ou l'image.

**Deux diapositives au maximum dans un oral de dix minutes :** (1) schéma des sources et tableau des volumes, avec « 69 avis, un utilisateur, pas de Big Data en volume » ; (2) flux SQL → features → Joblib et trois temps mesurés, avec les périmètres exclus. Question probable : « Où sont les 3V ? » Réponse : la variété est réelle, le volume et la vélocité massifs ne le sont pas ; la stratégie d'évolution est conditionnée par des mesures. Question : « Pourquoi pas Kafka/Spark ? » Réponse : aucune limite de débit ou de taille observée ne le justifie, et la complexité serait disproportionnée.
