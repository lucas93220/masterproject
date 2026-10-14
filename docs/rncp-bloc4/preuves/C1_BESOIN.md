# C1 — Besoin, données et stratégie

**Critère de la grille validée :** analyser une demande liée aux données, en évaluant volume, vélocité et variété, puis définir une stratégie proportionnée d'extraction de valeur. FITS est un projet personnel ; aucun commanditaire externe n'a formulé cette demande.

## Preuves disponibles

- Le besoin formulé par le candidat est de gagner du temps le matin, découvrir des associations de vêtements et remettre en usage des pièces oubliées. Le parcours observable va du dressing et de la météo à une tenue proposée, puis à un avis. [État actuel](../ETAT_ACTUEL.md#c1--besoin-sources-et-3v) ; [parcours mobile](../../../mobile/src/screens/home.js).
- Le relevé local du **13/10/2026** compte 385 tenues, 2 210 compositions et 171 avis dans PostgreSQL ; l'ancien relevé Mongo compte 233 logs. Les trois V, leurs périmètres et leurs limites sont détaillés dans l'état actuel. [Diagnostic PostgreSQL](../../../backend/scripts/diagnosePostgres.js) ; [diagnostic MongoDB](../../../backend/scripts/diagnoseMongo.js). Cela décrit un petit prototype, pas un volume massif de Big Data.
- Trois indicateurs métier ont été fixés **avant les essais** : temps jusqu'à une tenue acceptable, suggestions jugées nouvelles et utiles, et tenues acceptées réutilisant un vêtement préalablement déclaré oublié. Le [protocole et les tableaux à remplir](../PREPARATION_SOUTENANCE.md) prévoient aussi les échecs et incidents.
- Retour du concepteur du **14/10/2026** : une chemise seule à 9 °C ne lui paraît pas portable, et des lunettes de soleil proposées sans soleil lui semblent mal placées. Ces observations ont conduit à deux tests et règles de génération ciblés ; elles ne remplacent pas les essais des volontaires.

## Entretien et auto-essai du concepteur — 14/10/2026

Ces éléments sont des **déclarations d'une seule personne, qui a conçu FITS et connaît son dressing**. Ils éclairent le besoin ; ils ne constituent pas un retour indépendant ni une mesure généralisable.

| Point observé ou déclaré | Résultat et portée |
|---|---|
| Usage réel | FITS a jusqu'ici servi aux tests. Le candidat a déjà porté, indépendamment de FITS, des tenues semblables à certaines suggestions, par exemple bomber Scott, Henley à manches longues, jean et baskets classiques. Lors de l'auto-essai, il était chez lui et ne comptait pas sortir ; il aurait porté la première tenue aimée s'il était sorti. Il n'a pas encore porté une tenue **à la suite** d'une suggestion de FITS. |
| Premier choix acceptable | Dans un auto-essai, le candidat estime avoir mis environ **5 minutes sans FITS** et **30 secondes avec FITS** ; la troisième suggestion était la première acceptable. Ce sont des durées **estimées**, sur une seule comparaison, dans l'ordre sans FITS puis avec FITS : aucun gain de temps mesuré de façon contrôlée n'est établi. |
| Exploration après le premier choix | Il déclare avoir aimé trois des cinq premières suggestions. Il a continué volontairement à générer pour voir si FITS proposait encore des tenues qui lui plaisaient, dans le cadre du test. Cela ne montre pas une difficulté à choisir. Ces nombres proviennent de son récit, pas d'un journal de session vérifié. |
| Découverte | Il a réutilisé dans FITS les photos de vêtements précédemment proposés sur Vinted. En voyant les suggestions pendant ses tests, il s'est rendu compte que certains se mariaient avec son dressing actuel. Leur réutilisation **dans une tenue portée** n'est pas constatée. |
| Frein principal | Sélectionner les photos et renseigner les informations des vêtements pour constituer le dressing lui paraît long. Ce coût d'entrée n'a pas été chronométré et doit figurer dans l'évaluation du bénéfice global. |

Il ne cite pas de tenue récente précise qu'il exclurait de porter ; il évoque comme critères de rejet une association de trop nombreuses couleurs ou une tenue insuffisamment chaude. Ces exemples ne sont pas des suggestions effectivement observées lors de cet auto-essai. La reconnaissance automatique à partir d'une photo est une piste exprimée par le candidat, **pas une fonction disponible ni une solution évaluée**.

## Preuve manquante et décision

**Aucun volontaire n'a encore donné de retour explicite.** Les likes/dislikes et l'auto-essai du candidat ne prouvent ni un gain de temps général ni une satisfaction externe. Après deux ou trois essais, conserver les résultats individuels anonymisés, y compris les tâches non réussies, et ne conclure que sur ces personnes. Un dressing inconnu du participant ne permet pas de mesurer honnêtement la redécouverte de ses vêtements.

Les choix SQL, MongoDB et Python sont proportionnés aux fonctions actuelles. L'ajout d'une infrastructure distribuée n'est pas justifié par les volumes observés. La stratégie de croissance est de mesurer d'abord latence complète, erreurs, tailles et usages, puis de tester une optimisation ciblée si nécessaire.
