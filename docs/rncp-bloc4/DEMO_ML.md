# FITS — Démonstration reproductible sans modifier les modèles utilisés

Exécuter les commandes suivantes sur le Mac de développement. Elles ne nécessitent ni migration ni entraînement sur les avis réels. Ne jamais afficher ou commiter `ML_SERVICE_SECRET`, un JWT ou un export individuel.

## Démonstration isolée à montrer au jury

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_isolated.py
```

`demo_isolated.py` utilise un secret **fictif**, 30 lignes **synthétiques**, `TestClient` et un répertoire Joblib temporaire supprimé à la fin. Résultat attendu observé le 13/10/2026 : `train_status: model trained`, `meme_utilisateur: personalized`, `autre_utilisateur: fallback`, `raison_fallback: no_model`. C'est une preuve du **fonctionnement et de l'isolation**, pas de la performance réelle.

## Mesure réelle locale, uniquement en lecture

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/backend'
node scripts/reportEvaluationQuality.js
mkdir -p "$HOME/FITS-evaluations"
chmod 700 "$HOME/FITS-evaluations"
node scripts/exportEvaluationDataset.js ID_UTILISATEUR \
  "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json"

cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate.py \
  --input "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json"
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate_robust.py \
  --input "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json" --splits 30
```

Remplacer `ID_UTILISATEUR` par celui du compte de test dont les avis sont autorisés à être analysés ; ne pas mélanger plusieurs utilisateurs. Le script d'export vérifie que la cible est la base locale `fits`, refuse une destination dans le dépôt et crée le fichier en mode privé. L'analyse Python ne contacte ni PostgreSQL ni les modèles Joblib. Supprimer ensuite **uniquement** le fichier exporté, après avoir conservé les résultats agrégés utiles. Le rapport observé le 13/10/2026 est dans `PERFORMANCES_ML.md` ; les métriques peuvent changer quand les avis ou les vêtements changent.

## Communication entre les services existants

Le backend charge `backend/.env` au démarrage ; Python lit `ML_SERVICE_SECRET` dans son environnement de processus. Pour une démonstration réelle, conserver les deux valeurs identiques sans les afficher. Après l'avoir injecté dans le shell Python, démarrer les services dans deux terminaux :

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 -m uvicorn app:app --host 127.0.0.1 --port 8000
```

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/backend'
npm run dev
```

Les tests `backend/tests/mlJourney.integration.test.js` simulent le parcours Node → Python avec des fichiers temporaires et prouvent la séparation par utilisateur sans modifier les modèles existants. Une prédiction réelle `/api/ml/predict` nécessite un JWT du compte concerné et le schéma exact `outfit-v2` ; le résultat `model_used` indique `personalized` ou `fallback`. Ne pas appeler `/train` avec des avis réels pendant cette phase : un tel appel pourrait remplacer le Joblib de l'application.

Avant l'oral, vérifier séparément depuis le mobile la connexion, l'ajout d'une photo JPEG/PNG/WebP de moins de 5 Mo, la génération, un like et un dislike. **Ces actions écrivent en base de développement et peuvent réentraîner le modèle** : elles ne font pas partie des vérifications automatiques de cette phase et demandent une préparation/une sauvegarde adaptées. Le test de démonstration isolée ci-dessus permet de prouver le pipeline sans cet effet.
