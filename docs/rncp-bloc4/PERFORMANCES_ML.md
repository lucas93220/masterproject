# FITS — Performance ML réelle locale, 13 octobre 2026

**Portée.** Un seul utilisateur de la base locale `fits`, évalué hors ligne à partir d'un export privé temporaire supprimé après mesure. Les modèles Joblib de l'application n'ont été ni chargés, ni remplacés, ni entraînés par cette mesure. La provenance et la représentativité des avis restent à confirmer ; ces chiffres ne mesurent pas une population d'utilisateurs.

## Dataset et risques de fuite

- 69 avis bruts : 44 likes et 25 dislikes. Cinq avis sans température sont exclus par le constructeur de dataset ; il reste **64 avis, 42 likes (65,6 %) et 22 dislikes (34,4 %)**, chacun sur une tenue distincte.
- `outfit-v2` produit **85 features** ; **64 sont constantes** sur ces 64 avis. Les quatre features de base ont des moyennes proches entre classes : température 21,476/21,182 °C, vêtements 6,357/6,409, favoris 2,214/2,273, ratio favoris 0,352/0,359 (likes/dislikes). Ces moyennes ne suffisent pas à conclure à l'utilité ou l'inutilité de chaque variable.
- Parmi les indicateurs binaires qui varient, les plus grands écarts descriptifs observés restent modestes : `couleur_gris` est présent dans 59,5 % des likes contre 50,0 % des dislikes ; `couleur_torse_gris` dans 57,1 % contre 50,0 % ; `couleur_beige` dans 76,2 % contre 81,8 %. Ces calculs sur l'ensemble des avis **ne sont pas une importance de feature validée** et ne servent pas à choisir des variables pour le modèle testé.
- Il n'existe que **29 groupes distincts** après regroupement des tenues et des vecteurs de features exactement identiques : 35 lignes répètent un vecteur, et 11 motifs identiques portent des avis contradictoires. La même représentation ne peut donc pas séparer parfaitement tous les avis.
- L'identifiant de tenue et le label sont exclus des features. Une tenue ou un vecteur identique ne traverse jamais entraînement et test. Des tenues aux vecteurs différents peuvent néanmoins partager des vêtements. Seulement **3 des 69 avis** ont un snapshot valide ; les 66 autres peuvent utiliser des favoris, couleurs ou catégories modifiés *après* le vote. Cette dérive temporelle peut biaiser l'évaluation ; sa direction n'est pas mesurée.

## Méthode

`ml-service/evaluate_robust.py` utilise **30** graines à partir de 42, `StratifiedGroupKFold` à quatre plis et le premier pli satisfaisant au moins cinq likes et cinq dislikes en test pour chaque graine. Les 30 séparations sont admissibles ; l'entraînement contient entre **31 et 54** avis, le test entre **10 et 33**. Le regroupement par vecteur est volontairement conservateur. Les plis se recouvrent : moyenne, écart-type et extrêmes décrivent une sensibilité au découpage, **pas** une estimation statistique indépendante ni un intervalle de confiance.

Trois modèles sont ajustés uniquement sur chaque entraînement : le `RandomForestClassifier(random_state=42)` identique à `/train`, `DummyClassifier(strategy="most_frequent")` et une régression logistique L2 avec standardisation apprise sur l'entraînement. Le like est la classe positive. Aucun hyperparamètre n'a été choisi sur les tests. Il n'existe pas ici de jeu de validation indépendant pour sélectionner un modèle puis confirmer le choix sur un test final ; la régression logistique est une comparaison exploratoire, **pas** un modèle déployé.

| Modèle | Accuracy | Balanced accuracy | Précision like | Rappel like | F1 like | ROC AUC | Average precision |
|---|---:|---:|---:|---:|---:|---:|---:|
| Random Forest | 0,582 ± 0,073 | 0,467 ± 0,045 | 0,619 ± 0,059 | 0,901 ± 0,135 | 0,728 ± 0,066 | 0,402 ± 0,088 | 0,604 ± 0,074 |
| Classe majoritaire | **0,638 ± 0,059** | **0,500 ± 0,000** | **0,638 ± 0,059** | **1,000 ± 0,000** | **0,777 ± 0,045** | **0,500 ± 0,000** | **0,638 ± 0,059** |
| Régression logistique | 0,573 ± 0,105 | 0,468 ± 0,053 | 0,613 ± 0,085 | 0,825 ± 0,232 | 0,692 ± 0,136 | 0,436 ± 0,081 | 0,623 ± 0,071 |

L'accuracy du Random Forest varie de **0,429 à 0,680** ; celle de la baseline de **0,500 à 0,750**. Le Random Forest et la régression logistique ne dépassent la baseline en accuracy sur **aucune des 30 séparations appariées**. Le test stratifié unique antérieur donnait 0,375 contre 0,625 ; il utilisait un autre découpage, sans regroupement des vecteurs identiques, et ne doit pas être comparé comme une évolution du modèle.

**Classement.** ROC AUC et average precision mesurent le tri des avis tenus à l'écart ; le Random Forest est ici sous les références triviales correspondantes. FITS ne conserve ni les cinq candidats d'une même génération avec leurs scores, ni un jugement sur chacun. Il est donc impossible de calculer honnêtement NDCG@5, Precision@5 ou une amélioration du classement produit. Les métriques binaires ne prouvent pas la qualité des tenues proposées.

**Conclusion défendable à l'oral.** L'isolation par utilisateur, le pipeline ETL, l'entraînement et l'inférence fonctionnent, mais la qualité prédictive personnalisée n'est pas établie. La majorité des features ne varie pas dans cet échantillon, beaucoup de vecteurs sont répétés, et la baseline reste meilleure. FITS conserve le Random Forest comme référence expérimentale et son fallback ; aucune promotion de modèle n'est faite sur la base de cette analyse. Une collecte plus diverse avec snapshots systématiques, suivi des candidats et validation temporelle serait nécessaire avant une affirmation de gain.

Pour reproduire : `backend/scripts/reportEvaluationQuality.js` en lecture seule, export privé via `backend/scripts/exportEvaluationDataset.js`, puis `PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 ml-service/evaluate_robust.py --input <export-prive.json> --splits 30`. Voir `DEMO_ML.md` pour la procédure complète et la séparation des preuves réelles/synthétiques.
