# FITS — Deux visuels de preuves pour le jury

Ces graphiques reprennent **uniquement les mesures agrégées locales du 13 octobre 2026 déjà publiées dans le dépôt**. Ils n'utilisent ni dataset synthétique ni nouvelle lecture de la base. Ils sont destinés à expliquer la qualité du pipeline et les limites du Random Forest, pas à annoncer une performance représentative des utilisateurs de FITS. Source d'origine : `QUALITE_DONNEES.md`, `PERFORMANCES_ML.md` ; méthode ML : `ml-service/evaluate_robust.py`.

## 1. Ce qui entre réellement dans l'entraînement

![Avis FITS : 69 bruts, 64 utilisables, 5 exclus, 42 likes et 22 dislikes, 3 snapshots valides sur 69](visuels/qualite_avis.png)

**Lecture orale en 20 secondes :** « Il y a 69 avis d'un seul compte. Cinq avis sans température sont exclus, donc 64 lignes arrivent au ML : 42 likes, 22 dislikes. Trois des 69 avis bruts ont un snapshot valide ; pour l'historique restant, les attributs de vêtements peuvent avoir évolué après le vote. »

| Série tracée | Valeurs | Dénominateur et source |
|---|---|---|
| Passage ETL | 69 bruts ; 64 utilisables ; 5 exclus pour température absente | Avis agrégés de PostgreSQL local, `QUALITE_DONNEES.md` |
| Labels du dataset | 42 likes (65,6 %) ; 22 dislikes (34,4 %) | **64** lignes ML, `QUALITE_DONNEES.md` |
| Snapshots | 3 valides ; 66 absents | **69** avis bruts, `QUALITE_DONNEES.md` |

**Attention :** la barre snapshot utilise 69 avis bruts, pas 64 lignes ML. Le graphe ne permet pas d'affirmer combien des trois avis avec snapshot figurent parmi les 64 lignes finales. Les 69 avis proviennent d'un seul compte ; leur provenance et leur représentativité restent à confirmer.

## 2. Le modèle améliore-t-il la baseline ?

![Accuracy moyenne du Random Forest 58,2 % ± 7,3 points et de la majorité 63,8 % ± 5,9 points](visuels/accuracy_rf_baseline.png)

**Lecture orale en 20 secondes :** « Sur 30 séparations groupées qui se recouvrent, le Random Forest obtient 58,2 % d'accuracy moyenne contre 63,8 % pour la classe majoritaire. Il ne gagne aucun des 30 comparatifs appariés. Les moustaches représentent la dispersion des scores, pas un intervalle de confiance. Nous n'avons donc pas démontré de gain prédictif. »

| Série tracée | Accuracy moyenne ± écart-type descriptif | Étendue observée | Source |
|---|---:|---:|---|
| RF, 85 features | 0,582 ± 0,073 | 0,429 à 0,680 | `PERFORMANCES_ML.md` |
| Baseline, classe majoritaire de l'entraînement | 0,638 ± 0,059 | 0,500 à 0,750 | `PERFORMANCES_ML.md` |

L'écart moyen est de **−5,6 points** en défaveur du RF. Les deux modèles sont évalués sur les **mêmes** splits ; la précision, le rappel, le F1 et l'AUC figurent dans le rapport source. Le protocole bloque le passage d'une même tenue ou d'un vecteur de features strictement identique entre entraînement et test, mais **n'exclut pas la fuite temporelle** due aux 66 anciens avis sans snapshot. Les 30 tests se recouvrent et ne sont pas une validation externe indépendante. Un seul compte et 29 vecteurs distincts ne permettent pas de conclure sur les autres utilisateurs, ni de mesurer NDCG@5 ou la qualité de classement des cinq candidats d'une même génération.

## Réutilisation sûre

Les PNG sont prêts à insérer dans une diapositive. Garder sous chaque graphique sa **date, sa population et son périmètre** ; ne pas effacer les mentions « un compte », « local » ou « splits recouvrants ». Le premier graphique est un contrôle de qualité du dataset, le second une mesure de classification hors ligne. Les donner comme « performances réelles de FITS en production » serait faux. Aucun jeu individuel, secret, image de vêtement ou identifiant d'utilisateur n'est présent dans ces fichiers.
