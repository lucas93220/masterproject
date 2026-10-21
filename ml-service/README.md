# Service ML personnalisé

## Environnement reproductible

`requirements.txt` fixe les versions directes ; `requirements-lock-macos-py313.txt` ajoute les dépendances transitives actives observées dans l'environnement testé, macOS ARM64/Python 3.13.5. Ce verrou ne prétend pas avoir été validé sur toutes les plateformes. Créer un environnement isolé avant installation. Sur le Mac de développement :

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
mkdir -p "$HOME/.venvs"
/opt/anaconda3/bin/python3 -m venv "$HOME/.venvs/fits-ml"
"$HOME/.venvs/fits-ml/bin/python" -m pip install -r requirements-lock-macos-py313.txt
PYTHONDONTWRITEBYTECODE=1 "$HOME/.venvs/fits-ml/bin/python" -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 "$HOME/.venvs/fits-ml/bin/python" demo_isolated.py
```

La démonstration entraîne un modèle **synthétique dans un dossier temporaire** et affiche `personalized` pour le même identifiant, `fallback/no_model` pour un autre. Elle ne touche pas aux modèles de l'application. La méthode et les commandes d'évaluation hors ligne figurent dans la [fiche C2](../docs/rncp-bloc4/preuves/C2_MODELE.md) ; les commandes de démonstration sont dans la [préparation](../docs/rncp-bloc4/PREPARATION_SOUTENANCE.md).

L'entraînement de l'application passe normalement par `POST /api/ml/train` après l'enregistrement d'un avis ; Node construit le dataset de l'utilisateur authentifié et appelle `/train` côté Python. La commande manuelle suivante est documentée pour un essai **ultérieur**, sur une copie de développement avec sauvegarde du modèle concerné : elle peut remplacer `user_<id>.joblib` et **n'a pas été exécutée dans cette phase**.

```sh
curl -X POST http://127.0.0.1:3002/api/ml/train \
  -H "Authorization: Bearer $FITS_TEST_JWT" \
  -H 'Content-Type: application/json' -d '{}'
```

Ne pas saisir le JWT en clair dans l'historique du terminal. Pour prouver l'entraînement sans cet effet, utiliser `demo_isolated.py`.

Le backend Node.js envoie à `/train` et `/predict` l'identifiant issu de son utilisateur authentifié. Le service Python exige deux en-têtes internes : `X-FITS-USER-ID` et `X-FITS-ML-SECRET`. Le secret doit être identique dans l'environnement du backend et celui du service Python. Ne l'exposez pas au mobile et ne publiez pas le service Python directement sur Internet ; limitez son écoute à `127.0.0.1` ou à un réseau privé. Si les services sont sur deux hôtes, utilisez un transport privé ou TLS pour protéger le secret.

Configuration :

- `ML_SERVICE_SECRET` (obligatoire dans les deux processus) : secret aléatoire long, conservé hors du dépôt.
- `ML_SERVICE_URL` (backend, facultatif) : adresse interne du service Python ; valeur par défaut `http://127.0.0.1:8000`.
- `ML_MODELS_DIR` (Python, facultatif) : répertoire persistant des modèles ; valeur par défaut `ml-service/models`. Montez-y un volume persistant en déploiement et réservez ses droits d'écriture au service Python. Ne placez pas de fichiers non fiables dans ce dossier : `joblib` charge des objets Python sérialisés.
- `ML_MIN_TRAIN_SAMPLES` (Python, facultatif) : minimum total, `20` par défaut.
- `ML_MIN_SAMPLES_PER_CLASS` (Python, facultatif) : minimum de likes **et** de dislikes, `5` par défaut.
- `ML_PREDICT_TIMEOUT_MS` / `ML_TRAIN_TIMEOUT_MS` (Node) : délais par appel, respectivement `2000` / `15000` par défaut, de 1 à 120000 ms. L'avis déjà enregistré est conservé si le réentraînement échoue. Une panne pendant le score d'un lot fait recalculer tout ce lot avec le ratio de favoris, signalé dans `recommendation`.

Les seuils 20/5 sont des valeurs de départ à valider sur des données d'usage et des mesures de qualité. Un dataset vide, à classe unique ou sous ces seuils retourne `status: "insufficient_data"` avec une raison et les effectifs. Un éventuel modèle précédent reste utilisable. Un entraînement réussi écrit `user_<id>.joblib` de manière atomique. La prédiction recharge le modèle propre à cet utilisateur ; en son absence, ou si son fichier est invalide, elle retourne un score égal à `ratio_favoris` (ou `0` si absent), avec `model_used: "fallback"`.

L'ancien `model.joblib` partagé reste intact et n'est jamais utilisé par ce nouveau pipeline. Il n'est pas possible de l'attribuer à un utilisateur de façon fiable ; les modèles personnalisés se créeront au fil des réentraînements existants. Conservez ce fichier comme sauvegarde tant qu'une décision de migration ou d'archivage n'a pas été prise.

Lors d'une suppression de compte, Node appelle l'endpoint interne `POST /delete-model`. Python marque `user_<id>.deleted`, puis retire `user_<id>.joblib`, de manière idempotente. Le marqueur refuse une prédiction ou un entraînement tardif (HTTP 410) pour cet identifiant ; le compte neuf sans modèle conserve son fallback `no_model`. Si Python est indisponible, Node garde le manifeste privé à reprendre et répond `202`. Les essais utilisent des comptes et répertoires temporaires ; aucun Joblib réel n'a été supprimé.

**Exploiter avec un seul worker Python** : les verrous sont dans ce processus. Un déploiement avec plusieurs workers nécessiterait un verrou partagé à concevoir et tester. Lors d'une restauration, garder les marqueurs courants et les reçus privés Node indépendamment de l'ancienne sauvegarde ; ne pas réutiliser les identifiants effacés. Le contrôle de restauration SQL et ses limites sont décrits dans le dossier RNCP.

## Schéma des caractéristiques de l'étape 3B

La base locale mesurée possède déjà la colonne JSONB nullable ajoutée par `backend/migrations/20261013_add_evaluation_feature_snapshot.sql`. Vérifier l'état d'une autre base et la sauvegarder avant toute migration ; les tests ne l'exécutent pas. Chaque nouvel avis y conserve la couleur, le favori, la zone, la catégorie et la sous-catégorie des vêtements au moment du vote. Les nouveaux snapshots `version: 2` ajoutent aussi `id_vetement` pour chaque article ; les anciens `version: 1` restent lus sans migration. **Si la capture échoue, le contrôleur refuse le nouvel avis** ; les anciens avis sans instantané utilisent encore l'état actuel des vêtements, avec un risque de dérive après modification ou suppression.

Le backend construit toutes les lignes d'entraînement et de prédiction avec `backend/services/outfitFeatures.js`. Les colonnes numériques sont émises dans cet ordre : `temperature`, `nb_vetements`, `nb_favoris`, `ratio_favoris`, puis les `zone_<nom>` triées, les `couleur_<palette>`, les `couleur_torse_<palette>` et `couleur_jambes_<palette>`, les 8 colonnes `categorie_00` à `categorie_07`, `categorie_autre`, `categorie_inconnue`, les 16 colonnes `sous_categorie_00` à `sous_categorie_15`, `sous_categorie_autre`, `sous_categorie_inconnue`, puis `association_torse_jambes_meme_couleur` et `association_torse_jambes_neutre_colore`.

La palette fixe est `noir`, `blanc`, `gris`, `bleu`, `rouge`, `vert`, `jaune`, `orange`, `rose`, `violet`, `marron`, `beige`, `autre`, `inconnu`. Les 12 premières sont sélectionnables pour les nouveaux vêtements ; `autre` et `inconnu` restent des catégories internes pour l'historique. Les variantes textuelles anciennes sont toujours normalisées ; une couleur non reconnue va dans `autre`, une couleur absente dans `inconnu`. Les emplacements de catégories proviennent des libellés réellement présents dans `categorie` et `sous_categorie`, normalisés et triés. Au-delà de 8 catégories ou 16 couples catégorie/sous-catégorie, les autres vont dans `autre`. Les associations comparent la couleur dominante connue du torse et des jambes ; elles valent zéro si une des deux zones manque. Elles ne distinguent pas une paire précise de couleurs et ne prennent pas en charge deux couleurs par vêtement.

`feature_version` vaut `outfit-v2-<empreinte SHA-256>` des zones et vocabulaires retenus. Le service conserve cette version, le vocabulaire lisible et le modèle dans le même fichier Joblib ; il exige la même version et le même ordre de colonnes à la prédiction. Un ancien modèle Joblib, une version différente ou des colonnes incompatibles produisent le fallback ; aucun fichier de modèle n'est supprimé. Le prochain réentraînement admissible crée un modèle au nouveau format.

Tests isolés, sans données réelles : depuis `ml-service`, exécuter `PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v` avec un environnement Python contenant FastAPI, httpx, pandas, scikit-learn et joblib. Les tests utilisent des répertoires temporaires.

## Essai hors ligne des articles et paires

`evaluate_interactions.py` vérifie une évolution possible **sans entraîner ni charger les Joblib de l'application**. Il compare, sur le même test chronologique, la majorité (probabilité issue de la fréquence d'entraînement), le RF actuel à 85 features, le RF avec identité des articles seuls, le RF avec articles **et** paires, et une régression logistique L2 régularisée avec articles et paires. L'ablation « articles seuls » distingue le gain d'identité du gain des associations. Les nouveaux articles absents de l'entraînement sont ignorés par l'encodeur appris sur la partie entraînement ; les caractéristiques générales restent disponibles. Les paramètres sont fixés dans le script et ne sont pas réglés sur le test.

Depuis `backend`, après vérification de la base locale `fits` ciblée, exporter un compte dans un fichier privé **hors dépôt** :

```sh
node scripts/exportEvaluationDataset.js ID_UTILISATEUR /chemin/prive/interactions.json --interactions
```

Depuis `ml-service`, produire le rapport en lecture seule :

```sh
PYTHONDONTWRITEBYTECODE=1 python3 evaluate_interactions.py --input /chemin/prive/interactions.json
PYTHONDONTWRITEBYTECODE=1 python3 evaluate_interactions.py --synthetic
```

Le mode `--interactions` garde l'export habituel inchangé. Il ajoute les identifiants, leur provenance (`snapshot` ou `composer_current`) et la date du vote ; une ligne sans identité et date utilisables est exclue, avec effectif indiqué dans l'export. Les identifiants reconstruits via `composer` pour d'anciens avis ne sont pas figés au moment du vote : lire leur résultat comme exploratoire. `evaluate_interactions.py --synthetic` génère un rapport fictif à la demande pour vérifier l'outil ; ses chiffres ne décrivent pas FITS. Aucun avis réel n'a été exporté ou réentraîné par cette procédure de développement.

Le protocole demande au moins 50 avis dont 20 par classe avant séparation, puis au moins 40 avis d'entraînement et 15 de test avec les deux classes. Il purge de l'entraînement les tenues, compositions et vecteurs `outfit-v2` identiques à ceux du test. Des articles et paires individuels peuvent apparaître des deux côtés : c'est précisément la capacité de réutilisation recherchée. Ce test unique ne mesure pas le classement des cinq candidats car seul le candidat affiché est évalué. Ne pas publier l'export individuel ni interpréter une seule séparation comme preuve de gain généralisable.

## Variante expérimentale articles/paires — 21 octobre 2026

**Livrée sur `experiment/garment-interactions`, désactivée par défaut.** Le service `app.py` et les Joblib de référence restent inchangés. Aucun avis réel n'a été exporté, aucun modèle réel n'a été entraîné par ce développement. La branche Git ne protège pas les bases ou les modèles : leur isolation est une configuration distincte.

`experimental_app.py` expose `/train`, `/predict`, `/predict-batch` et `/delete-model`. Il utilise `interaction_model.py` : les mêmes caractéristiques générales `outfit-v2`, des indicateurs binaires `item:<id>` et `pair:<id>:<id>`, puis une régression logistique L2 (`C=0.1`, `max_iter=3000`, graine 42). Ce choix fixe reprend le candidat déjà présent dans l'évaluation hors ligne ; ce n'est pas une nouvelle recherche de paramètres sur les scores connus, ni la preuve que ce candidat surpasse le RF. La [régularisation](https://scikit-learn.org/1.6/modules/generated/sklearn.linear_model.LogisticRegression.html) limite l'amplitude des coefficients. Le [DictVectorizer](https://scikit-learn.org/1.6/modules/generated/sklearn.feature_extraction.DictVectorizer.html) apprend son vocabulaire sur l'entraînement seulement. L'encodeur est partagé avec `evaluate_interactions.py` et sa parité numérique est testée.

Les identifiants sont des catégories, jamais des valeurs ordinales. Un article/pair inconnu est ignoré par le vocabulaire figé ; les caractéristiques générales restent utilisées. `unknown_garments` permet de diagnostiquer ce cas côté service. La variante peut apprendre des associations malgré des caractéristiques générales identiques ; elle ne détermine pas la cause certaine d'un dislike, ne traite pas les photos et ne comprend pas automatiquement le style. Les effets sont additifs sur le score logistique ; aucune interaction d'ordre supérieur ni pondération temporelle n'est ajoutée. De nouveaux avis peuvent faire évoluer les préférences, mais un changement de goût rapide n'est pas garanti.

La construction expérimentale du dataset exige des identités provenant d'un snapshot version 2. Les lignes historiques `composer_current` sont exclues ; les autres validations/propriétés de `trainingDataset.js` restent actives. Aucun backfill ni migration. Les votes restent des votes sur la tenue entière ; leur enregistrement et le réentraînement après avis conservent leur fonctionnement.

L'activation se fait côté Node avec **deux variables explicites** : `ML_EXPERIMENTAL_USER_ID` (un compte de test) et `ML_EXPERIMENTAL_URL` (`http://127.0.0.1:8001`, distinct du port de référence). Le mobile ne peut pas choisir le compte ciblé. Les autres comptes gardent le RF. Ce mode refuse `NODE_ENV=production` et les destinations non locales. Le batch de cinq candidats maximum est évalué sous le même verrou, avec une révision unique ; Node contrôle le nombre et la validité des scores. La génération et ses filtres ne changent pas. La réponse `recommendation` ajoute `model_variant: "items-pairs-v1"` et `model_revision` quand un score expérimental personnalisé a effectivement été utilisé.

Les artefacts expérimentaux vont **obligatoirement hors du dépôt**, dans `ML_EXPERIMENTAL_MODELS_DIR`, sans chevauchement avec `ML_MODELS_DIR` ou le dossier de référence. Un dossier non vide sans marqueur `.fits-items-pairs-v1` est refusé. Les fichiers sont privés ; sauvegarde atomique et verrous de fichier macOS/Linux protègent les entraînements concurrents. Aucun Joblib de référence n'est chargé. Garder un seul worker reste la configuration simple recommandée. Conserver ce dossier local privé et ne pas y importer de Joblib provenant d'autrui.

Les seuils techniques restent 20 avis, cinq par classe. Si le dataset est insuffisant ou si la sauvegarde échoue, l'ancien modèle expérimental est conservé. Sans modèle compatible, le fallback reste le ratio de favoris ; une panne ne déclenche aucun appel au modèle de référence pour le compte expérimental. Les suppressions sont envoyées aux deux services tant que `ML_EXPERIMENTAL_URL` est configurée, même après retrait de l'identifiant expérimental ; un échec reste repris par le mécanisme existant de suppression différée.

### Démonstration immédiate sans donnée réelle

Depuis `ml-service` :

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_interactions.py
```

La démo utilise 80 avis fictifs par utilisateur avec des préférences opposées, un contexte identique et un stockage temporaire nettoyé à la fin. Elle vérifie l'association distinguée, l'isolation, le fallback et l'intégrité d'un fichier de référence fictif. **Ce n'est pas une mesure de performance de FITS.**

### Essai ultérieur dans le mobile et retour arrière

Ces commandes **n'ont pas été exécutées sur les services de l'application**. Préparer d'abord une copie de test PostgreSQL/Mongo/uploads : le mode expérimental protège les Joblib de référence, mais un clic de l'application écrit toujours tenues et avis dans les bases configurées. L'identifiant doit correspondre au compte dans cette copie. Un dossier expérimental neuf est nécessaire pour une autre copie de base, afin de ne pas réutiliser un identifiant avec un autre utilisateur. Ne pas modifier le `.env` réel pour cet essai ; fournir les variables de la copie dans le terminal Node avant le démarrage, avec les outils déjà documentés de préparation des environnements isolés.

Dans un terminal depuis `backend`, démarrer uniquement le nouveau Python (port 8001 libre) avec le secret existant, sans l'afficher :

```sh
export ML_EXPERIMENTAL_MODELS_DIR="$(mktemp -d /private/tmp/fits-interactions.XXXXXX)"
ML_PYTHON=/opt/anaconda3/bin/python3 node - <<'JS'
require('dotenv').config({ quiet: true });
const { spawn } = require('node:child_process');
if (!process.env.ML_SERVICE_SECRET) throw new Error('ML_SERVICE_SECRET requis');
const child = spawn(process.env.ML_PYTHON, [
  '-m', 'uvicorn', 'experimental_app:app', '--host', '127.0.0.1',
  '--port', '8001', '--workers', '1'
], { cwd: '../ml-service', env: process.env, stdio: 'inherit' });
child.on('error', () => { console.error('Démarrage expérimental impossible'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
JS
```

Dans le terminal du **backend de test**, une fois les variables des stockages isolés configurées et `FITS_TEST_USER_ID` renseigné avec l'identifiant de son compte :

```sh
ML_EXPERIMENTAL_USER_ID="${FITS_TEST_USER_ID:?Renseigner le compte de la copie de test}" \
ML_EXPERIMENTAL_URL=http://127.0.0.1:8001 npm run dev
```

Conserver aussi le service RF de référence disponible pour les autres comptes et les suppressions. Le premier entraînement expérimental suit le mécanisme habituel après avis ; avec trop peu de snapshots admissibles, `fallback/no_model` est normal. Vérifier la réponse de génération : `model_used: personalized` **et** `model_variant: items-pairs-v1` confirment cette variante. Le `/api/ml/predict` de diagnostic requiert également `garment_ids` pour le compte expérimental ; la génération les fournit depuis le dressing côté serveur.

Pour retrouver le fonctionnement de référence dans cette copie, arrêter normalement Node puis relancer **sans `ML_EXPERIMENTAL_USER_ID`**. Garder `ML_EXPERIMENTAL_URL` et le Python expérimental disponibles tant que ses modèles personnels existent, pour que les suppressions atteignent les deux stockages. Attention : les votes ultérieurs en mode référence réentraînent à nouveau le RF de la copie, comme avant. Le retour de configuration n'efface pas les avis produits pendant l'essai. Clôturer/nettoyer séparément les ressources de test après inventaire ; ne pas simplement supprimer la configuration d'effacement alors que des artefacts expérimentaux subsistent. Aucune commande de purge automatique n'est fournie.

### Comparaison avant toute décision de promotion

Sur un export privé `--interactions`, évaluer la population réellement admissible :

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate_interactions.py \
  --input /chemin/prive/interactions.json --snapshot-only
```

Le protocole conserve le RF, la majorité, l'ablation articles seuls, le RF avec paires et le candidat logistique fixe. Les dates égales à la frontière temporelle sont maintenant retirées de l'entraînement pour éviter d'inventer un ordre chronologique. Avec trop peu d'observations après purge, aucune métrique n'est produite. Conserver une cohorte future indépendante : les scores historiques déjà consultés ne peuvent pas valider cette variante. Ne pas multiplier les réglages après lecture du test. Pour cette comparaison, fixer à l'avance ROC AUC et Brier, et rapporter aussi accuracy, balanced accuracy, F1 et effectifs. Ces scores ne prouvent toujours pas la qualité du classement des candidats non jugés. Ni promotion ni réécriture des métriques RNCP historiques n'est automatique.

Vérification du 21 octobre : **178 tests backend**, dont un pont Node → vrai Python expérimental avec 85 caractéristiques ; **51 tests Python** ; démo temporaire réussie. Les **63 tests mobile** passent en neuf processus distincts. L'exécution mobile regroupée a subi deux crashes V8/Node 24.11.1 (`SIGSEGV` pendant le ramasse-miettes), sans assertion en échec ; cause profonde non établie, ce lanceur groupé reste à fiabiliser. Aucun code mobile supplémentaire n'a été modifié pour cette expérimentation.
