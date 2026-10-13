# Service ML personnalisé

Le backend Node.js envoie à `/train` et `/predict` l'identifiant issu de son utilisateur authentifié. Le service Python exige deux en-têtes internes : `X-FITS-USER-ID` et `X-FITS-ML-SECRET`. Le secret doit être identique dans l'environnement du backend et celui du service Python. Ne l'exposez pas au mobile et ne publiez pas le service Python directement sur Internet ; limitez son écoute à `127.0.0.1` ou à un réseau privé. Si les services sont sur deux hôtes, utilisez un transport privé ou TLS pour protéger le secret.

Configuration :

- `ML_SERVICE_SECRET` (obligatoire dans les deux processus) : secret aléatoire long, conservé hors du dépôt.
- `ML_SERVICE_URL` (backend, facultatif) : adresse interne du service Python ; valeur par défaut `http://127.0.0.1:8000`.
- `ML_MODELS_DIR` (Python, facultatif) : répertoire persistant des modèles ; valeur par défaut `ml-service/models`. Montez-y un volume persistant en déploiement et réservez ses droits d'écriture au service Python. Ne placez pas de fichiers non fiables dans ce dossier : `joblib` charge des objets Python sérialisés.
- `ML_MIN_TRAIN_SAMPLES` (Python, facultatif) : minimum total, `20` par défaut.
- `ML_MIN_SAMPLES_PER_CLASS` (Python, facultatif) : minimum de likes **et** de dislikes, `5` par défaut.

Les seuils 20/5 sont des valeurs de départ à valider sur des données d'usage et des mesures de qualité. Un dataset vide, à classe unique ou sous ces seuils retourne `status: "insufficient_data"` avec une raison et les effectifs. Un éventuel modèle précédent reste utilisable. Un entraînement réussi écrit `user_<id>.joblib` de manière atomique. La prédiction recharge le modèle propre à cet utilisateur ; en son absence, ou si son fichier est invalide, elle retourne un score égal à `ratio_favoris` (ou `0` si absent), avec `model_used: "fallback"`.

L'ancien `model.joblib` partagé reste intact et n'est jamais utilisé par ce nouveau pipeline. Il n'est pas possible de l'attribuer à un utilisateur de façon fiable ; les modèles personnalisés se créeront au fil des réentraînements existants. Conservez ce fichier comme sauvegarde tant qu'une décision de migration ou d'archivage n'a pas été prise.

Tests isolés, sans données réelles : depuis `ml-service`, exécuter `PYTHONDONTWRITEBYTECODE=1 python -m unittest discover -s tests -v` avec un environnement Python contenant FastAPI, httpx, pandas, scikit-learn et joblib. Les tests utilisent des répertoires temporaires.
