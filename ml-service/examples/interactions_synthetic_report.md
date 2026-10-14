# Interactions vêtement–vêtement — SYNTHÉTIQUE — AUCUNE PERFORMANCE RÉELLE DE FITS

- Source : DONNÉES SYNTHÉTIQUES générées par evaluate_interactions.py
- Compte : un seul utilisateur ; identifiant non publié
- Avis : 160 ; likes : 102 ; dislikes : 58
- Températures (°C → avis) : {5: 7, 6: 7, 7: 7, 8: 7, 9: 7, 10: 7, 11: 7, 12: 7, 13: 7, 14: 7, 15: 6, 16: 6, 17: 6, 18: 6, 19: 6, 20: 6, 21: 6, 22: 6, 23: 6, 24: 6, 25: 6, 26: 6, 27: 6, 28: 6, 29: 6}
- Lignes v2 exploitables : 160 ; exclues de cette analyse faute d’identité/date fiable : 0
- Identifiants : {'snapshot': 160}
- Articles/paires distincts : 8/28
- Paires observées ≥2/≥3 fois : 28/28
- Méthode : Découpage chronologique 75/25, graine 42 ; retrait de l’entraînement des tenues, compositions et vecteurs v2 identiques au test. Vocabulaire des articles/paires appris sur l’entraînement seulement.

- Découpage : 56 avis entraînement, 40 test ; 64 doublons retirés
- Classes entraînement : 32 likes/24 dislikes ; test : 27/13
- Températures entraînement/test : {5: 2, 6: 2, 7: 2, 8: 1, 9: 1, 10: 2, 11: 2, 12: 2, 13: 2, 14: 3, 15: 3, 16: 2, 17: 2, 18: 2, 19: 2, 20: 3, 21: 4, 22: 2, 23: 2, 24: 2, 25: 3, 26: 2, 27: 2, 28: 3, 29: 3} / {5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2, 12: 2, 13: 2, 14: 2, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1, 21: 1, 22: 1, 23: 1, 24: 1, 25: 2, 26: 2, 27: 2, 28: 2, 29: 2}
- Début du test : 2026-01-01T02:00:00+00:00
- Paires du test déjà vues en entraînement : 28/28
- Nouveaux articles présents seulement dans le test : 0
- Colonnes entraînées : 85 de base, 93 avec articles, 121 avec articles/paires

| Modèle | Accuracy | Balanced accuracy | F1 like | ROC AUC | AP | Log loss ↓ | Brier ↓ |
|---|---:|---:|---:|---:|---:|---:|---:|
| Majorité | 0.675 | 0.500 | 0.806 | 0.500 | 0.675 | 0.653 | 0.230 |
| RF actuel, features v2 | 0.600 | 0.504 | 0.724 | 0.420 | 0.622 | 0.767 | 0.270 |
| RF + articles seuls | 0.550 | 0.527 | 0.640 | 0.591 | 0.745 | 0.672 | 0.238 |
| RF + articles/paires | 0.525 | 0.548 | 0.578 | 0.566 | 0.742 | 0.729 | 0.261 |
| Logistique L2 + articles/paires | 0.650 | 0.641 | 0.720 | 0.618 | 0.787 | 0.658 | 0.234 |

Un seul test temporel : aucune recherche de découpage favorable ni réglage de paramètres. Les scores concernent les tenues étiquetées dans cet export ; ils ne mesurent pas le classement des cinq candidats non jugés. Le partage d’articles entre entraînement et test est voulu pour tester les préférences apprises ; une corrélation de paire ne prouve pas la cause du vote. Aucun modèle Joblib applicatif n’est chargé ou modifié.

