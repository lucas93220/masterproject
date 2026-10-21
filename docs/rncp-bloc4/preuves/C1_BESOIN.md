# C1 — Besoin et stratégie de données

FITS est un projet personnel : proposer rapidement une tenue à partir du dressing et de la météo, faire découvrir des associations et remettre en vue des vêtements oubliés. Aucun commanditaire externe n'a formulé le besoin. La [grille validée par l'établissement](../ETAT_ACTUEL.md) demande d'analyser la demande, les sources et les trois V ; elle ne transforme pas ce prototype en système Big Data massif.

## Preuves à montrer

- [Parcours mobile](../../../mobile/src/screens/home.js) : météo, suggestion, avis. Le dressing est saisi manuellement ; c'est le coût d'entrée principal signalé par le concepteur. La [refonte mobile](../../../mobile/src/screens/dressing.js) facilite ensuite la recherche, les filtres et les favoris ; ces améliorations n'ont pas encore été évaluées auprès de volontaires.
- Sources : vêtements, tenues et avis PostgreSQL ; snapshots JSONB ; météo externe ; photos et journaux. Le [relevé local du 21/10](../ETAT_ACTUEL.md#c1--besoin-et-sources) compte **657 tenues et 433 avis**, dont **159 avis le 21/10**. Le volume reste limité, la vélocité dépend des votes manuels et la variété vient de ces formats. Aucun débit continu ni gain lié à une architecture distribuée n'est démontré.
- Le concepteur a relevé qu'une chemise seule à 9 °C lui paraît trop légère et que les lunettes de soleil devraient dépendre du soleil. Ces retours ont mené à des règles testées dans le générateur. Ils concernent la plausibilité des candidats, pas une performance prédictive mesurée.

## Auto-essai du concepteur, à présenter comme tel

Il estime avoir choisi une tenue acceptable en environ **5 min sans FITS** puis **30 s avec FITS**, à la troisième suggestion ; trois des cinq premières suggestions lui plaisaient. Les durées sont **estimées, sans chronomètre**, sur une seule personne et dans un ordre fixe. Il a continué à générer par curiosité pendant des tests chez lui ; il n'a encore jamais porté une tenue *à la suite* d'une suggestion de FITS. En réutilisant des photos de vêtements qu'il avait mis sur Vinted, il a découvert pendant les essais des associations possibles avec son dressing actuel ; aucune réutilisation dans une tenue portée n'est constatée. [Récit et contexte](../ETAT_ACTUEL.md#c1--besoin-et-sources).

## Preuve à compléter avant l'oral

Aucun retour indépendant de volontaire n'est documenté. Le [protocole prêt](../PREPARATION_SOUTENANCE.md#essais-de-volontaires) prévoit deux ou trois personnes, leurs propres comptes, une comparaison chronométrée à choix acceptable, les suggestions nouvelles et utiles, et la réutilisation d'un vêtement déclaré oublié avant l'essai. Conserver aussi les échecs et le temps de saisie du dressing. Avec un si petit groupe, rapporter des observations individuelles, sans promettre un gain général. Si ces essais n'ont pas lieu, annoncer explicitement que l'utilité externe reste à démontrer.
