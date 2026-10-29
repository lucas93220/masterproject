# FITS — Service de recommandation personnalisé

## Modèle articles/paires par défaut

Depuis le 21/10/2026, **tous les comptes** sont classés par le modèle `items-pairs-v1` : une régression logistique L2 personnelle fondée sur les **85 caractéristiques générales `outfit-v2`**, les identifiants des vêtements et leurs paires. Le nom `experimental_app.py` est historique ; il héberge désormais le service normal sur le port **8001**. `ML_EXPERIMENTAL_USER_ID` est ignoré. Le Random Forest dans `app.py` reste un **comparateur hors ligne** et son service sur le port **8000** sert encore à supprimer les anciens Joblib personnels ; aucun Joblib RF n'est remplacé.

Node obtient l'identité de sa session authentifiée et l'envoie par `X-FITS-USER-ID` ; le mobile ne peut choisir aucun modèle ou compte. `ML_SERVICE_SECRET` protège les deux services et reste hors Git. Les services écoutent en loopback. Le modèle articles/paires n'utilise que les avis avec **snapshot version 2 ou 3 et identifiants figés**. Il faut au moins **20 avis admissibles, dont cinq likes et cinq dislikes**, pour entraîner le modèle d'un compte. Un jeu vide, à classe unique ou trop petit rend `insufficient_data` et conserve l'ancien modèle valide. Un modèle absent/incompatible ou une panne donne un `fallback` explicite au ratio de favoris ; il n'y a **aucun retour automatique au RF**. La génération des candidats garde ses filtres thermiques et de couleurs.

Les artefacts articles/paires sont séparés du dépôt et du dossier RF. La sauvegarde atomique, le verrouillage par compte et le contrôle de version limitent les corruptions. L'entraînement après un avis peut modifier le Joblib **articles/paires du compte concerné** ; un essai manuel dans l'application n'est donc pas une lecture seule. Les suppressions de compte atteignent les deux services, afin de retirer aussi les anciens Joblib RF. La réponse `202` demande une reprise du nettoyage. Garder les reçus et marqueurs de suppression lors d'une restauration.

### Démarrage local sur macOS

Installer les dépendances Python du projet dans un environnement dédié (versions directes dans [requirements.txt](requirements.txt), verrou macOS/Python 3.13 dans [requirements-lock-macos-py313.txt](requirements-lock-macos-py313.txt)). Le backend charge `backend/.env`, qui contient le secret utilisé par les deux processus Python. Aucune valeur de secret n'est imprimée par le lanceur.

Dans trois terminaux distincts :

```sh
cd backend
ML_PYTHON=/opt/anaconda3/bin/python3 npm run ml:services

cd backend
npm run dev

cd mobile
npm run start -- --clear
```

Le lanceur démarre **RF 8000 + articles/paires 8001**, chacun avec un worker. Il utilise par défaut `~/.fits/models/items-pairs-v1` pour les modèles courants. Sur le Mac de développement, le Joblib articles/paires déjà entraîné du compte de test y a été **copié depuis `/private/tmp` sans écraser l'original** et vérifié identique. Sur un autre Mac, définir `ML_EXPERIMENTAL_MODELS_DIR` vers le dossier privé existant du modèle concerné ; ne pas importer arbitrairement un Joblib d'autrui. Un dossier neuf entraîne d'abord un `fallback/no_model` jusqu'à ce que le compte possède assez d'avis v2 et vote à nouveau. Le nom de variable `ML_EXPERIMENTAL_MODELS_DIR` est historique. Si les ports sont occupés, arrêter les anciens services avant de lancer la commande ; ne pas faire tourner deux serveurs sur le même port.

`ML_SERVICE_URL` peut désigner le RF local (défaut `http://127.0.0.1:8000`) et `ML_EXPERIMENTAL_URL` le service courant (défaut `http://127.0.0.1:8001`). Le lanceur accepte uniquement des URL loopback distinctes. Python lit `ML_SERVICE_SECRET` de son environnement. Le mobile utilise l'hôte LAN fourni par Expo ou `EXPO_PUBLIC_API_URL` ; sur un autre réseau, vérifier l'accès depuis le téléphone. Le lanceur ne démarre ni PostgreSQL ni MongoDB.

### Vérification sans données réelles

```sh
cd ml-service
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 -m unittest discover -s tests -v
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_interactions.py
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 demo_isolated.py
```

Les démos utilisent des préférences **synthétiques** et des dossiers temporaires ; elles prouvent l'isolation de deux utilisateurs, le score et le fallback, jamais la performance réelle. Le [guide RNCP](../docs/rncp-bloc4/PREPARATION_SOUTENANCE.md) décrit les tests Node/mobile et le parcours sur appareil.

## Caractéristiques et snapshots

Le backend [outfitFeatures.js](../backend/services/outfitFeatures.js) émet dans le même ordre à l'entraînement et à la prédiction : température, nombre de vêtements, favoris et ratio ; neuf zones ; indicateurs de couleur, catégorie, sous-catégorie et deux associations générales. Le total est **85 colonnes**. `feature_version` inclut une empreinte des vocabulaires ; un modèle d'une autre version ne sert pas de score personnalisé. Les nouvelles couleurs viennent d'une palette contrôlée ; les anciennes couleurs libres sont normalisées.

Le snapshot JSONB d'un nouvel avis conserve les caractéristiques au moment du vote. La **version 2** inclut `id_vetement` par pièce. L'ETL actuel ne transmet au modèle articles/paires que les avis v2 avec identités valides ; les anciens avis sans snapshot restent en base, mais leur identité reconstruite via `composer` n'est pas une preuve historique et n'entraîne pas le modèle courant. Aucune migration ou modification des anciennes lignes n'a été faite pour ce basculement. Une erreur de snapshot empêche le nouvel avis d'être enregistré.

## Évaluation hors ligne et limites

[evaluate_interactions.py](evaluate_interactions.py) compare sur un test chronologique fixé la majorité, le RF à 85 features, RF+articles, RF+articles+paires et le modèle courant logistique L2. Son vocabulaire est appris sur le train ; il purge les mêmes tenues, compositions et vecteurs v2 du train. Pour les résultats récents, utiliser `--snapshot-only` afin d'exclure les identités reconstruites. Les scripts n'entraînent ni ne remplacent les Joblib de l'application.

Après avoir vérifié que la base visée est bien la base **locale de développement**, exporter un seul compte vers un fichier privé **hors Git** :

```sh
cd backend
node scripts/exportEvaluationDataset.js ID_UTILISATEUR /chemin/prive/interactions.json --interactions
cd ../ml-service
PYTHONDONTWRITEBYTECODE=1 python3 evaluate_interactions.py --input /chemin/prive/interactions.json --snapshot-only
```

Supprimer ensuite l'export privé. `evaluate_interactions.py --synthetic` vérifie le script, sans mesure réelle. Le protocole demande au moins 50 avis dont 20 par classe avant séparation, puis au moins 40 avis d'entraînement et 15 de test avec les deux classes ; ces seuils évitent un test manifestement trop petit, sans garantir une généralisation. Seule la tenue affichée reçoit un avis : ROC AUC sur ces avis ne mesure pas le classement des cinq candidats et NDCG@5 ne peut pas être calculé honnêtement. Les [résultats datés et limites](../docs/rncp-bloc4/preuves/C2_MODELE.md) restent distincts selon les comptes et les températures. Le choix de rendre articles/paires normal est une décision produit, **pas** une preuve scientifique que son avantage prédictif est établi.

Pour une **nouvelle série prospective**, redémarrer le backend avec MongoDB disponible avant de voter. À chaque génération, Node conserve dans le journal Mongo le score de la seule tenue affichée, son modèle et sa révision **avant** la réponse au mobile. Ces traces sont incluses dans la suppression du compte et sont éligibles à la purge des logs après 30 jours ; cette purge reste à exécuter par l'exploitant. Depuis `backend`, consulter ensuite les agrégats sans écrire en base :

```sh
node scripts/reportProspectivePredictions.js ID_UTILISATEUR
```

Le rapport compte uniquement les prédictions personnalisées enregistrées avant leur vote ; il exclut les fallbacks et les avis non encore donnés. Sa baseline majoritaire utilise seulement les avis avec snapshot v2 antérieurs à chaque prédiction. S'il n'y a pas de trace ou si Mongo était indisponible, il ne calcule aucune accuracy. Les modèles peuvent être réentraînés entre deux votes : cette mesure décrit le système adaptatif effectivement utilisé, pas un modèle figé. Ne pas republier les journaux ou les exports individuels ; ne rapporter que les agrégats.

## Catalogue v3 facultatif

La [version enrichie du dressing](../backend/WARDROBE_CATALOGUE.md) active `outfit-v3` côté Node, après migration explicite. Elle ajoute les deux couleurs et un catalogue plus large aux features générales, en gardant le même modèle L2 articles/paires. Le stockage v3 est `user_<id>_outfit_v3.joblib`, sans écraser le modèle v2 ; les deux sont effacés lors de la suppression du compte. Sans activation, le contrat `outfit-v2` reste utilisé. Aucun modèle applicatif n’a été entraîné ou remplacé lors de cette implémentation.
