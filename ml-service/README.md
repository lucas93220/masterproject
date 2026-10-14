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

La base locale mesurée possède déjà la colonne JSONB nullable ajoutée par `backend/migrations/20261013_add_evaluation_feature_snapshot.sql`. Vérifier l'état d'une autre base et la sauvegarder avant toute migration ; les tests ne l'exécutent pas. Chaque nouvel avis y conserve la couleur, le favori, la zone, la catégorie et la sous-catégorie des vêtements au moment du vote. **Si la capture échoue, le contrôleur refuse le nouvel avis** ; les anciens avis sans instantané utilisent encore l'état actuel des vêtements, avec un risque de dérive après modification ou suppression.

Le backend construit toutes les lignes d'entraînement et de prédiction avec `backend/services/outfitFeatures.js`. Les colonnes numériques sont émises dans cet ordre : `temperature`, `nb_vetements`, `nb_favoris`, `ratio_favoris`, puis les `zone_<nom>` triées, les `couleur_<palette>`, les `couleur_torse_<palette>` et `couleur_jambes_<palette>`, les 8 colonnes `categorie_00` à `categorie_07`, `categorie_autre`, `categorie_inconnue`, les 16 colonnes `sous_categorie_00` à `sous_categorie_15`, `sous_categorie_autre`, `sous_categorie_inconnue`, puis `association_torse_jambes_meme_couleur` et `association_torse_jambes_neutre_colore`.

La palette fixe est `noir`, `blanc`, `gris`, `bleu`, `rouge`, `vert`, `jaune`, `orange`, `rose`, `violet`, `marron`, `beige`, `autre`, `inconnu`. Les 12 premières sont sélectionnables pour les nouveaux vêtements ; `autre` et `inconnu` restent des catégories internes pour l'historique. Les variantes textuelles anciennes sont toujours normalisées ; une couleur non reconnue va dans `autre`, une couleur absente dans `inconnu`. Les emplacements de catégories proviennent des libellés réellement présents dans `categorie` et `sous_categorie`, normalisés et triés. Au-delà de 8 catégories ou 16 couples catégorie/sous-catégorie, les autres vont dans `autre`. Les associations comparent la couleur dominante connue du torse et des jambes ; elles valent zéro si une des deux zones manque. Elles ne distinguent pas une paire précise de couleurs et ne prennent pas en charge deux couleurs par vêtement.

`feature_version` vaut `outfit-v2-<empreinte SHA-256>` des zones et vocabulaires retenus. Le service conserve cette version, le vocabulaire lisible et le modèle dans le même fichier Joblib ; il exige la même version et le même ordre de colonnes à la prédiction. Un ancien modèle Joblib, une version différente ou des colonnes incompatibles produisent le fallback ; aucun fichier de modèle n'est supprimé. Le prochain réentraînement admissible crée un modèle au nouveau format.

Tests isolés, sans données réelles : depuis `ml-service`, exécuter `PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v` avec un environnement Python contenant FastAPI, httpx, pandas, scikit-learn et joblib. Les tests utilisent des répertoires temporaires.
