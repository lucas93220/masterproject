# Évaluation hors ligne du Random Forest FITS

- Source : SYNTHÉTIQUE — démonstration uniquement
- Version des features : outfit-v2-synthetic-example
- Dataset : 160 avis, 80 tenues distinctes
- Répartition : 108 likes, 52 dislikes
- Graine aléatoire : 42

## Méthodologie

StratifiedGroupKFold à 4 plis, premier pli admissible en test ; groupes = id_tenue
Entraînement : 120 avis (80 likes, 40 dislikes), 60 tenues.
Test : 40 avis (28 likes, 12 dislikes), 20 tenues.
La baseline prédit toujours la classe majoritaire du seul ensemble d'entraînement.

## Métriques sur le test

| Modèle | Accuracy | Précision (like) | Rappel (like) | F1 (like) |
|---|---:|---:|---:|---:|
| Random Forest | 0.850 | 0.923 | 0.857 | 0.889 |
| Classe majoritaire | 0.700 | 0.700 | 1.000 | 0.824 |

Matrice de confusion (lignes = réel, colonnes = prédit ; ordre dislike, like) :

- Random Forest : [[10, 2], [4, 24]]
- Baseline : [[0, 12], [0, 28]]

## Limites

Une seule séparation aléatoire : les scores varient avec l'échantillon. Les données d'utilisateurs différents ne doivent jamais être mélangées.
Des tenues distinctes partageant les mêmes vêtements peuvent encore être corrélées. Les anciens avis sans snapshot peuvent refléter l'état actuel de la garde-robe.
Les labels proviennent des appréciations observées et ne mesurent pas la satisfaction future. Ces métriques de classification ne mesurent pas directement la qualité du classement des tenues générées.
Données synthétiques : ces chiffres ne mesurent pas la performance réelle de FITS.
