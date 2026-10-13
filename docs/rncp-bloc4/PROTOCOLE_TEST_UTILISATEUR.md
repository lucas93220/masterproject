# FITS — Test utilisateur court avant la soutenance (C1)

**Statut : protocole prêt, résultats non recueillis.** FITS est un projet défini par son auteur, sans commanditaire externe. Deux ou trois personnes distinctes du compte test ont été envisagées ; leur participation et leurs retours restent à constater. Ce test mesure la compréhension et l'utilité perçue du parcours, **pas** la précision ni la capacité de généralisation du Random Forest.

## Préparation

1. **Option simple pour le test d'usage :** faire essayer l'application sur le Mac de développement avec un ou, de préférence, un compte fictif distinct par volontaire. Cela crée réellement des comptes, vêtements, tenues, avis et journaux dans les bases configurées ; les votes peuvent créer des Joblib propres à ces comptes. Vérifier d'abord que PostgreSQL et Mongo pointent bien vers des environnements de test, conserver une sauvegarde de développement, et noter les identifiants des comptes de test dans un support privé pour les distinguer des 64 avis historiques. Ne pas interpréter les nouveaux avis comme une nouvelle mesure du RF. Si aucune écriture dans ces bases n'est souhaitée, utiliser une instance isolée ou se limiter à l'observation guidée sans vote et l'indiquer dans le compte rendu.
2. Préparer le même petit dressing fictif et la même température pour chaque participant. Ne pas retoucher les conditions après avoir vu un résultat. Noter l'appareil et les éventuelles pannes réseau ou météo ; elles comptent comme incidents du parcours, non comme erreurs de la personne.
3. Expliquer en une phrase le but de FITS ; préciser que ce n'est pas un examen de la personne. Demander l'accord pour noter des observations anonymisées. Aucun nom, e-mail, IP, image personnelle, JWT ou enregistrement audio/vidéo n'est nécessaire. Utiliser seulement P1, P2, P3 et ne publier une citation directe qu'avec accord.

## Trois tâches identiques pour chacun

| Tâche donnée sans guider les gestes | Observation factuelle |
|---|---|
| « Ajoute un vêtement fictif à la garde-robe. » | Réussite sans aide (oui/non), durée, blocages et messages d'erreur. |
| « Génère une tenue et explique ce que tu comprends du résultat. » | Réussite sans aide, durée, compréhension de la tenue et éventuel fallback visible ou non. |
| « Indique que cette tenue ne te plaît pas et cherche une autre proposition. » | Le dislike est-il compris ? La nouvelle tenue arrive-t-elle ? Durée et blocages. L'avis est écrit dans l'environnement choisi et peut déclencher un réentraînement du modèle de ce compte. |

Après les tâches, poser les mêmes questions ouvertes : « Qu'est-ce qui t'a aidé ? », « Qu'est-ce qui t'a gêné ? », « Utiliserais-tu cette proposition dans une situation réelle, et pourquoi ? » Ne pas demander de donner un chiffre de satisfaction orienté. Si la personne évoque un vêtement inadapté ou une préférence, noter le contexte, sans prétendre que cela mesure le classement de cinq candidats.

## Fiche de résultats à remplir après chaque session

| Participant pseudonyme | Date | Appareil / conditions | T1 sans aide / temps | T2 sans aide / temps | T3 sans aide / temps | Incidents techniques | Observations et retour libre |
|---|---|---|---|---|---|---|---|
| P1 | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir |
| P2 | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir |
| P3, si disponible | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir | À remplir |

Rapporter le nombre de tâches réussies sans aide sur le nombre **effectivement tentées**, les durées observées et les thèmes récurrents, avec le dénominateur affiché. Les pannes doivent être conservées dans le compte rendu. Un seuil de travail préalable, à ne pas présenter comme atteint avant mesure, serait que chaque tâche soit réussie sans aide par au moins deux des trois personnes si trois participent. Avec une ou deux personnes, présenter seulement les observations individuelles anonymisées ; éviter pourcentages et prétentions de représentativité.

**Limites :** ce petit test peut révéler des problèmes de compréhension et fournir un premier retour externe authentique. Il ne valide ni un besoin de marché, ni une charge Big Data, ni une amélioration du Random Forest face à la baseline. Les 69 avis historiques du compte test restent un autre jeu de données et ne doivent pas être ajoutés à ces observations.

## Analyse prévue avant de voir les nouveaux avis

Attribuer un compte distinct à chaque volontaire et, si souhaité, un nouveau compte au développeur pour la version actuelle. Conserver les anciens résultats comme **cohorte historique** : les tenues ont pu être sélectionnées par une ancienne version du pipeline et 66 avis n'ont pas de snapshot. Ne pas effacer ce compte ni fusionner automatiquement ses avis avec les nouveaux. Noter la version de l'application, la date et le compte pseudonyme de chaque session dans un support privé, sans publier les identifiants ni les avis individuels.

Pour chaque nouveau compte, rapporter séparément : avis bruts, likes/dislikes, températures valides, snapshots présents, lignes exploitables et nombre de groupes de tenues/vecteurs distincts. Regrouper ensuite uniquement ces **comptes agrégés** pour décrire le déroulement du test ; les modèles FITS restent entraînés par utilisateur. Le seuil applicatif par défaut de **20 avis dont au moins cinq de chaque classe** (configurable) permet seulement d'entraîner un modèle personnel ; il ne suffit pas à prouver sa qualité. Si un compte fournit assez de données et de groupes indépendants pour un jeu d'entraînement et un jeu de test, appliquer un découpage fixé à l'avance qui sépare les tenues/vecteurs identiques, puis comparer le Random Forest à la classe majoritaire sur le même test. Sinon, écrire « métriques prédictives non fiables / non calculées ». Ne pas publier une moyenne globale des avis de trois personnes comme une accuracy personnalisée.

Une différence entre la cohorte historique et la cohorte actuelle ne prouverait pas à elle seule une amélioration du modèle : génération, vêtements, utilisateurs et sélection des tenues peuvent avoir changé simultanément. Les évaluations des personnes sur leur propre compte apportent d'abord un retour d'usage réel ; la qualité du classement des candidats non montrés reste non mesurée.
