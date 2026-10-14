# C1 — Besoin, données et stratégie

**Critère de la grille validée :** analyser une demande liée aux données, en évaluant volume, vélocité et variété, puis définir une stratégie proportionnée d'extraction de valeur. FITS est un projet personnel ; aucun commanditaire externe n'a formulé cette demande.

## Preuves disponibles

- Le besoin formulé par le candidat est de gagner du temps le matin, découvrir des associations de vêtements et remettre en usage des pièces oubliées. Le parcours observable va du dressing et de la météo à une tenue proposée, puis à un avis. [État actuel](../ETAT_ACTUEL.md#c1--besoin-sources-et-3v) ; [parcours mobile](../../../mobile/src/screens/home.js).
- Le relevé local du **13/10/2026** compte 385 tenues, 2 210 compositions et 171 avis dans PostgreSQL ; l'ancien relevé Mongo compte 233 logs. Les trois V, leurs périmètres et leurs limites sont détaillés dans l'état actuel. [Diagnostic PostgreSQL](../../../backend/scripts/diagnosePostgres.js) ; [diagnostic MongoDB](../../../backend/scripts/diagnoseMongo.js). Cela décrit un petit prototype, pas un volume massif de Big Data.
- Trois indicateurs métier ont été fixés **avant les essais** : temps jusqu'à une tenue acceptable, suggestions jugées nouvelles et utiles, et tenues acceptées réutilisant un vêtement préalablement déclaré oublié. Le [protocole et les tableaux à remplir](../PREPARATION_SOUTENANCE.md) prévoient aussi les échecs et incidents.

## Preuve manquante et décision

**Aucun volontaire n'a encore donné de retour explicite.** Les likes/dislikes du candidat sont des labels ML, pas une mesure de gain de temps ou de satisfaction. Après deux ou trois essais, conserver les résultats individuels anonymisés, y compris les tâches non réussies, et ne conclure que sur ces personnes. Un dressing inconnu du participant ne permet pas de mesurer honnêtement la redécouverte de ses vêtements.

Les choix SQL, MongoDB et Python sont proportionnés aux fonctions actuelles. L'ajout d'une infrastructure distribuée n'est pas justifié par les volumes observés. La stratégie de croissance est de mesurer d'abord latence complète, erreurs, tailles et usages, puis de tester une optimisation ciblée si nécessaire.
