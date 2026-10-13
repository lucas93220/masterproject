# FITS — Analyse finale ciblée du ML (13 octobre 2026)

**Décision pour la soutenance : arrêter le développement du modèle et préparer la présentation.** Le pipeline personnalisé fonctionne, mais les avis disponibles ne démontrent ni un gain prédictif face à une baseline simple, ni une amélioration du classement des cinq tenues générées. Le Random Forest actuellement utilisé et ses Joblib restent inchangés. Une nouvelle variante testée maintenant sur ces mêmes avis risquerait surtout de sélectionner un résultat favorable par hasard.

## Données et information disponible

Mesure hors ligne sur la base de développement locale `fits`, pour **un seul utilisateur** : 69 avis bruts, dont cinq sans température exclus par l'ETL ; **64 avis exploitables, 42 likes et 22 dislikes**. L'export privé temporaire a été supprimé après la mesure. Il ne s'agit pas d'une estimation représentative de tous les utilisateurs. La provenance des avis locaux doit être confirmée avant de les qualifier d'observations réelles à l'oral.

| Famille `outfit-v2` | Colonnes | Colonnes qui varient dans les 64 avis |
|---|---:|---:|
| Température, nombre de vêtements, favoris, ratio favoris | 4 | 4 |
| Zones | 9 | 2 |
| Couleurs globales et par zone | 42 | 10 |
| Catégories | 10 | 1 |
| Sous-catégories | 18 | 3 |
| Associations de couleurs | 2 | 1 |
| **Total** | **85** | **21** |

Les **64 colonnes constantes** n'apportent aucune information discriminante dans cet échantillon. Les 21 variables sont : `temperature`, `nb_vetements`, `nb_favoris`, `ratio_favoris`, `zone_exterieur`, `zone_yeux`, `couleur_gris`, `couleur_bleu`, `couleur_beige`, `couleur_autre`, `couleur_torse_noir`, `couleur_torse_gris`, `couleur_torse_beige`, `couleur_jambes_noir`, `couleur_jambes_gris`, `couleur_jambes_autre`, `categorie_00`, `sous_categorie_01`, `sous_categorie_10`, `sous_categorie_11` et `association_torse_jambes_meme_couleur`. Elles ne représentent que **17 profils de colonnes distincts** : `zone_yeux`, `categorie_00` et `sous_categorie_01` sont identiques sur ces avis ; `couleur_beige` et `couleur_torse_beige` aussi ; de même pour `couleur_autre` et `couleur_jambes_autre`. `ratio_favoris` est en outre calculé à partir de `nb_favoris` et `nb_vetements`. Ces redondances sont propres à l'échantillon, pas nécessairement au schéma général.

**Aucune feature individuelle ne peut être déclarée prédictive sur cette preuve.** Une variable qui varie peut seulement *potentiellement* informer le modèle ; les écarts descriptifs entre likes et dislikes dans `PERFORMANCES_ML.md` ne constituent pas une validation hors échantillon. La comparaison contrôlée ci-dessous teste la contribution collective des 81 indicateurs supplémentaires, sans choisir de colonnes après lecture des résultats.

## Groupes, généralisation et fuite

Les 64 avis portent sur 64 identifiants de tenue différents, mais seulement **29 vecteurs de features distincts**. Les tailles des groupes sont : 16 groupes d'un avis, six de deux, quatre de trois, et un groupe de cinq, de sept et de douze avis. **Onze vecteurs identiques ont reçu les deux labels.** Au moins 16 avis seraient nécessairement mal classés par un prédicteur déterministe qui donne la même réponse à un même vecteur ; cela borne à **48/64 = 75 %** son accuracy *sur ces observations*, sans estimer sa performance future. Ces contradictions peuvent refléter des préférences non décrites par les features, la variabilité des avis ou la reconstruction de l'historique.

Les deux expériences utilisent les **mêmes quatre plis fixés avant mesure** (`StratifiedGroupKFold`, graine 42). Un groupe relie un même `id_tenue` ou un vecteur de 85 features exactement identique. Ni `id_tenue` ni `is_liked` n'entrent dans les features. Chaque avis est testé une fois ; aucun groupe ne traverse entraînement et test. Les tests comptent respectivement **5, 24, 22 et 13 avis** ; le premier n'a qu'**un dislike**, ce qui rend ses métriques particulièrement fragiles. Aucune graine, feature ou hyperparamètre n'a été ajusté après observation des scores.

Cette vérification écarte les fuites par tenue et vecteur identiques, **pas toutes les fuites possibles**. Des tenues aux vecteurs différents peuvent partager des vêtements. Selon le rapport de qualité existant, seuls **3/69 avis** disposent d'un snapshot valide : les autres sont reconstruits à partir de l'état actuel des vêtements, potentiellement modifié après le vote. Cette fuite temporelle ne peut pas être quantifiée ici. La sélection préalable par le générateur limite aussi la généralisation à des tenues jamais montrées.

## Deux expériences hors ligne, sans promotion de modèle

**1. Ablation des indicateurs vestimentaires.** Le `RandomForestClassifier(random_state=42)` de référence, avec ses 85 colonnes et les mêmes paramètres que `/train`, est comparé au même algorithme utilisant uniquement les quatre variables globales prédéfinies. La baseline `DummyClassifier(strategy='prior')` prédit la classe majoritaire de l'entraînement et utilise sa proportion de likes comme probabilité constante. Tous sont réentraînés en mémoire sur chaque pli, sans lire ni écrire les Joblib de FITS.

**2. Utilité des probabilités comme score.** Sur ces mêmes plis tenus à l'écart, ROC AUC compare des paires like/dislike *à l'intérieur de chaque pli* ; l'AUC pondérée par le nombre de paires résume les **271 paires** disponibles. Average precision (AP) et score de Brier sont rapportés en moyennes non pondérées des quatre plis ; pour Brier, **plus bas est meilleur**. Ces chiffres mesurent uniquement la discrimination et la qualité des probabilités sur les avis observés.

| Modèle hors ligne | Accuracy moyenne [min ; max] | Balanced accuracy | ROC AUC pondérée par paires | AP moyenne | Brier moyen |
|---|---:|---:|---:|---:|---:|
| Random Forest, 85 features | 0,517 [0,400 ; 0,583] | 0,414 | 0,358 | 0,586 | 0,311 |
| Random Forest, 4 globales | 0,609 [0,538 ; 0,708] | 0,465 | 0,485 | 0,692 | 0,278 |
| Baseline : proportion/majorité de l'entraînement | **0,670 [0,538 ; 0,800]** | **0,500** | **0,500** | 0,670 | **0,229** |

Les moyennes **ne sont pas des intervalles de confiance** : quatre plis très inégaux et 29 groupes ne permettent pas de conclusion fine. L'AUC moyenne non pondérée par pli vaut 0,285 pour le Random Forest complet, 0,526 pour les quatre variables et 0,500 pour la baseline ; l'écart entre 0,526 et l'AUC pondérée 0,485 montre la sensibilité à la taille des plis. L'AP du modèle à quatre variables dépasse légèrement celle de la baseline, mais son AUC pondérée reste inférieure à 0,5 et son Brier est moins bon. L'ablation suggère que les indicateurs supplémentaires n'aident pas **sur cet échantillon**, mais ne démontre pas qu'ils sont inutiles en général. Aucune variante ne justifie un remplacement du modèle utilisé par FITS.

Ces résultats concordent avec l'évaluation répétée antérieure (`PERFORMANCES_ML.md`) : sur 30 séparations groupées qui se recouvrent, le Random Forest complet obtient une accuracy moyenne de **0,582** contre **0,638** pour la majorité, et ne la dépasse dans aucune séparation. C'est la **même petite base**, pas une validation externe indépendante.

## Ce que le jury peut et ne peut pas conclure sur le classement

Le backend génère jusqu'à cinq candidats, demande une probabilité de like au service ML pour chacun, puis conserve uniquement le meilleur. Il n'enregistre ni le lot complet, ni ses scores, ni des avis sur les candidats non retenus. Il est donc impossible de mesurer honnêtement le **Precision@5, NDCG@5 ou un gain de classement réel**. L'AUC ci-dessus compare des tenues choisies et évaluées séparément ; elle ne démontre pas que l'ordre des cinq candidats d'une même génération est bon. Elle ne justifie pas non plus d'inverser les scores du modèle : les 64 avis sont trop peu nombreux et soumis à un biais de sélection.

**Formulation orale recommandée :** « FITS entraîne un Random Forest propre à chaque utilisateur et classe cinq tenues avec un score de like. Le fonctionnement est démontré, mais, sur 64 avis exploitables d'un seul compte, sa valeur prédictive n'est pas établie : la baseline majoritaire fait mieux. Nous conservons donc ce score comme expérimental et présentons explicitement le fallback. » Montrer les 29 groupes, l'absence de fuite par groupe dans le protocole et la limite des snapshots. Une vraie mesure du classement demanderait, après la soutenance, des lots de candidats tracés et des jugements comparables sur les candidats exposés ; ce n'est pas un développement à lancer maintenant.

## Reproduction et contrôles

Le script `ml-service/audit_final_ml.py` lit uniquement un export JSON privé d'un utilisateur, conforme à `outfit-v2` ; il ne se connecte pas à PostgreSQL et ne charge aucun Joblib. Utiliser la procédure d'export local protégée de `DEMO_ML.md`, puis exécuter :

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/ml-service'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 audit_final_ml.py --input '<export-prive.json>'
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 -m unittest discover -s tests -v
```

La mesure ci-dessus a utilisé un export dans `/private/tmp` protégé en mode 0700 et supprimé à la fin ; la base et les modèles applicatifs n'ont pas été modifiés. **23 tests Python passent**, dont trois tests ciblés du nouvel audit sur données fictives. Les chiffres synthétiques des tests ne figurent pas dans les tableaux de performance réelle.
