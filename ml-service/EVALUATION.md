# Évaluer le Random Forest hors ligne

`evaluate.py` entraîne temporairement un Random Forest avec les mêmes paramètres que `/train` (`random_state=42`) et compare ses prédictions à un classifieur qui choisit toujours la classe majoritaire de l'entraînement. Il ne charge, ne modifie ni ne sauvegarde aucun modèle Joblib. Il ne contacte pas PostgreSQL.

Depuis `ml-service`, utiliser l'environnement Python qui contient déjà `pandas` et `scikit-learn` :

```sh
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate.py --synthetic
```

Le rapport reproductible de cette commande est dans `examples/evaluation_synthetique.md`. **Ses chiffres sont fictifs et ne prouvent rien sur la qualité réelle de FITS.**

Pour évaluer plus tard un seul utilisateur de la base locale de développement, appliquer d'abord la migration `20261013_add_evaluation_feature_snapshot.sql` si elle n'a pas encore été appliquée, puis exporter son dataset dans un dossier privé **hors du dépôt**. Le script d'export réutilise la construction des features de production et ajoute `id_tenue` seulement au fichier d'évaluation. Il lit PostgreSQL sans écrire dans la base et refuse une cible distante ou un fichier dans le dépôt. Il charge aussi la configuration backend habituelle, qui tente une connexion MongoDB au démarrage.

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/backend'
mkdir -p "$HOME/FITS-evaluations"
chmod 700 "$HOME/FITS-evaluations"
node scripts/exportEvaluationDataset.js ID_UTILISATEUR "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json"

cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate.py \
  --input "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json"
```

Remplacer `ID_UTILISATEUR` par l'identifiant du compte à mesurer. Le fichier JSON contient des préférences personnelles ; il est créé avec des permissions limitées à l'utilisateur et ne doit pas être commité. L'évaluation ne doit pas regrouper plusieurs utilisateurs : les modèles FITS sont personnels.

Le format d'entrée est `{ "feature_version": "outfit-v2-...", "data": [...] }`. Chaque ligne contient exactement les colonnes numériques `outfit-v2` du pipeline, `is_liked` (0 ou 1) et `id_tenue` (entier positif). Sans `id_tenue`, la séparation sûre n'est pas possible et le script refuse le fichier.

Le script demande au moins 50 avis, dont 20 de chaque classe. Il exige aussi au moins 5 likes et 5 dislikes dans le test. Ces seuils initiaux servent uniquement à éviter de publier des métriques basées sur quelques exemples ; ils ne garantissent pas une estimation stable. Quand chaque tenue apparaît une fois, une séparation stratifiée 75/25 est utilisée. Sinon, les avis sont groupés par `id_tenue` dans une séparation stratifiée à 4 plis ; le premier pli respectant les seuils est retenu. Une même tenue ne peut donc pas être dans l'entraînement et le test. Dans la base FITS actuelle, la clé `(id_utilisateur, id_tenue)` et l'upsert conservent normalement un seul avis par tenue et par utilisateur ; le regroupement protège aussi les exports historiques ou préparés autrement. Si la séparation ne respecte pas les seuils, le rapport indique « métriques non calculées ».

La baseline et le Random Forest sont ajustés uniquement sur l'entraînement. Les mesures (accuracy, précision, rappel, F1 et matrice de confusion) portent uniquement sur le test ; le like est la classe positive. Les scores décrivent une seule séparation et un seul utilisateur. Des tenues différentes peuvent partager les mêmes vêtements et rester corrélées. FITS classe des tenues par probabilité de like ; ces mesures binaires ne testent pas directement la qualité de ce classement. Une évaluation plus forte demanderait davantage d'utilisateurs et de tenues, des intervalles d'incertitude et une validation temporelle ; ces travaux ne sont pas inclus dans `evaluate.py`.

## Évaluation répétée et comparaison à un modèle simple

`evaluate_robust.py` est un second outil **hors ligne**. Il laisse `evaluate.py`, `/train` et les Joblib existants intacts. Sur un export privé d'un seul utilisateur, il effectue par défaut 30 séparations entraînement/test. Il regroupe les lignes d'une même tenue **et** celles dont le vecteur de features est strictement identique ; aucun groupe ne traverse les deux ensembles. Sans doublons, il utilise des séparations stratifiées 75/25. Avec des doublons, il utilise `StratifiedGroupKFold` avec plusieurs graines et conserve un pli admissible par graine. Les séparations se recouvrent : la dispersion n'est **pas** un intervalle de confiance indépendant.

La comparaison emploie les paramètres actuels du Random Forest de production, un classifieur majoritaire et une régression logistique L2 précédée d'une standardisation apprise **uniquement** sur l'entraînement. Aucun paramètre n'est choisi à partir des résultats du test. Le rapport donne accuracy, balanced accuracy, précision, rappel, F1, ROC AUC et average precision, puis moyenne, écart-type et extrêmes. ROC AUC et average precision évaluent l'ordre des **avis observés**, pas le classement des cinq candidats d'une même génération : FITS ne conserve pas les jugements de tous ces candidats.

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 evaluate_robust.py \
  --input "$HOME/FITS-evaluations/avis-ID_UTILISATEUR.json" --splits 30
```

L'option `--synthetic` utilise seulement des données **fictives** pour vérifier le script. Le résultat réel local du 13/10/2026, ses limites et les chiffres agrégés sont dans `../docs/rncp-bloc4/ETAT_ACTUEL.md`. Supprimer l'export privé après usage ; ne jamais le commiter.

Un second relevé réel du 13/10/2026 porte sur un **compte récent distinct**, avec 100 avis et 100 snapshots. Les résultats agrégés de ses 30 découpages groupés sont également dans `ETAT_ACTUEL.md` ; ils ne remplacent pas le relevé historique à 64 avis, qui vient d'un autre compte. L'export privé temporaire utilisé pour le second relevé a été supprimé après calcul.
