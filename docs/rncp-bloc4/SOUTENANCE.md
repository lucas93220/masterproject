# FITS — Soutenance bloc 4, trame de dix minutes

Cette trame s'appuie sur [l'état actuel](ETAT_ACTUEL.md), les [cinq fiches de preuves](preuves/) et la [préparation pratique](PREPARATION_SOUTENANCE.md). Adapter les formulations à ce que le candidat a réellement réalisé et aux retours qu'il aura effectivement recueillis. La grille validée demande cinq décisions « valide / non valide » ; les notes sur 20 évoquées pendant la préparation sont seulement diagnostiques. Elle mentionne aussi un **dossier REX** : les pièces sont maintenant réparties entre ces documents, et leur format de remise doit être confirmé auprès de l'établissement.

| Temps indicatif | Diapo | Preuve à afficher et phrase juste |
|---:|---|---|
| 0:45 | 1. Besoin — C1 | Projet personnel : gagner du temps le matin, découvrir des associations et des vêtements oubliés. Aucun gain utilisateur encore mesuré. [C1](preuves/C1_BESOIN.md). |
| 1:00 | 2. Sources et 3V — C1 | Météo, dressing SQL, avis/snapshots, logs et images ; dernier relevé local : 385 tenues et 171 avis, 233 logs Mongo sur un relevé antérieur. Variété observée, volume massif absent. |
| 1:15 | 3. ETL et qualité — C3 | Historique : 69 avis → 64 lignes utilisables, cinq températures absentes, trois snapshots ; compte récent : 100/100 snapshots. Montrer le [visuel historique](visuels/qualite_avis.png) sans mélanger les comptes. [C3](preuves/C3_DONNEES.md). |
| 1:00 | 4. Stockage — C4 | Relations SQL, snapshot JSONB ; index étudié sur 100 000 tenues **fictives** : 2,081 → 0,139 ms, coût 728 Kio, sans migration réelle. [C4](preuves/C4_STOCKAGE.md). |
| 1:45 | 5. Programme — C5 | Jusqu'à cinq candidats admissibles, 85 features, modèle personnel ou fallback, vote et snapshot. Montrer la sortie de [demo_isolated.py](../../ml-service/demo_isolated.py) si utile. [C5](preuves/C5_PROGRAMME.md). |
| 1:30 | 6. Résultat ML — C2 | Ancien compte : RF 58,2 % contre majorité 63,8 %. Compte récent séparé : RF 62,4 % contre majorité 65,9 % sur 30 splits recouvrants. **Aucun gain prédictif démontré.** [C2](preuves/C2_MODELE.md). |
| 1:15 | 7. Protection et limites — C3/C5 | Images privées, contrôle de session, suppression et reprise testées sur moteurs temporaires ; ancien historique et sauvegardes réelles restent à traiter. Les 211 tests sont une preuve fonctionnelle, pas une conformité complète. |
| 1:30 | 8. Décision — C1/C2 | Conserver le RF comme référence expérimentale ; recueillir des retours d'usage et des avis sincères, variés, avec snapshots, puis refaire une évaluation fixée à l'avance. Ne pas promettre un gain non mesuré. |

## Réponses courtes aux questions probables

- **Pourquoi le RF est-il sous la baseline ?** Les deux jeux restent petits, avec des vecteurs identiques parfois étiquetés différemment ; l'ancien a 66 snapshots absents et des votes parfois aléatoires, le récent n'a qu'une température. Ce sont des facteurs observés, pas une cause unique démontrée.
- **Le modèle sert-il actuellement ?** Il produit un score personnel et classe les candidats lorsqu'un modèle compatible existe. Son avantage sur la règle majoritaire n'est pas prouvé. Le fallback s'active en absence de modèle ou en cas de panne, pas lorsque l'accuracy du RF est faible.
- **Pourquoi ne pas changer d'algorithme maintenant ?** Tester plusieurs variantes sur les mêmes petits jeux déjà inspectés favoriserait un résultat fortuit. Le prochain changement doit être évalué sur des avis indépendants et une baseline fixée avant l'expérience.
- **La fuite entre entraînement et test est-elle éliminée ?** Le protocole sépare les mêmes tenues et vecteurs identiques. Les vêtements partagés et la reconstruction de l'historique laissent des risques résiduels.
- **Le classement des cinq tenues est-il mesuré ?** Non : seul le candidat présenté reçoit un avis. L'AUC des avis exposés ne donne pas un NDCG@5.
- **Pourquoi PostgreSQL et MongoDB ?** SQL porte les relations et transactions métier. MongoDB porte des logs et une voie photo ; son avantage à cette échelle reste à démontrer et il complique le cycle de vie des données.
- **FITS est-il conforme RGPD ou PSH ?** Des contrôles techniques ont été testés ; l'exploitation des sauvegardes, l'historique, une revue juridique et un audit d'accessibilité restent à faire. Le prototype LAN utilise HTTP.
- **Quels retours utilisateurs ?** Aucun retour externe documenté à ce jour. Ajouter uniquement les observations réellement recueillies avec le [protocole](PREPARATION_SOUTENANCE.md).
- **Pourquoi ne pas publier le jeu réel sur Git ?** Les préférences individuelles restent privées. Le code et les fixtures synthétiques sont reproductibles ; une diffusion de données réelles exigerait une revue de confidentialité.
- **Quelle performance est mesurée ?** Quelques lectures SQL et une prédiction Python locale. La latence complète du parcours mobile, la charge et un SLA ne sont pas mesurés.

## Avant d'entrer dans la salle

Confirmer l'intitulé du bloc auprès de l'établissement : la grille validée mentionne BC04B, une autre cellule BC04A. Vérifier que le code et les jeux fictifs sont réellement accessibles sur le serveur Git attendu. Relire les contributions personnelles. Ne montrer ni `.env`, JWT, secret ML, adresse e-mail, export d'avis individuel ou photo privée. Le [guide](PREPARATION_SOUTENANCE.md) contient les contrôles du Mac et la sortie de secours si le téléphone ou le réseau échoue.
