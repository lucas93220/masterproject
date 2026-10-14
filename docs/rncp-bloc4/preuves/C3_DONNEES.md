# C3 — ETL, qualité et protection des données

**Critère de la grille validée :** extraire, transformer et charger des données pertinentes, en contrôler la qualité et permettre leur interprétation en protégeant les personnes concernées.

## Preuves disponibles

| Étape | Réalisation et preuve |
|---|---|
| Extraire | [trainingDataset.js](../../../backend/services/trainingDataset.js) sélectionne les avis d'un utilisateur authentifié et les vêtements de ses tenues. |
| Contrôler | Propriété de la tenue, booléen du vote, température et composition sont vérifiés ; les nouveaux votes prennent un snapshot avant l'enregistrement. [Contrôleur](../../../backend/controllers/evaluationController.js) ; [tests](../../../backend/tests/evaluationController.test.js). |
| Transformer et charger | [outfitFeatures.js](../../../backend/services/outfitFeatures.js) forme les 85 indicateurs `outfit-v2` ; le dataset personnel est transmis à `/train`. Le test avec [vrais moteurs temporaires](../../../backend/tests/isolated/pipeline.test.js) vérifie que modifier ensuite un vêtement ne modifie pas le snapshot du vote. |
| Mesurer la qualité | [reportEvaluationQuality.js](../../../backend/scripts/reportEvaluationQuality.js) produit des agrégats en lecture seule. Relevé du 13/10/2026 : 171 avis, cinq températures absentes, 105 snapshots valides et 66 absents ; sur le compte récent, 100/100 snapshots valides. [État et graphique historique](../ETAT_ACTUEL.md#c3--etl-qualité-et-protection-des-données). |
| Protéger et supprimer | [Images privées](../../../backend/routes/privateImageRoutes.js), rôle actuel relu en SQL, [suppression coordonnée](../../../backend/services/accountDeletion.js), reprise et blocage après restauration. Les scénarios isolés vérifient SQL, MongoDB, fichiers et Joblib sans compte réel. |

Les cinq avis sans température sont exclus sans en inventer une. Les 66 avis historiques sans snapshot peuvent refléter l'état **actuel** des vêtements plutôt que celui du vote. Ils restent dans la base ; aucun backfill non vérifiable n'a été appliqué. Les mesures de comptes différents ne sont pas fusionnées pour entraîner un modèle commun.

## Limites à annoncer

La rétention de 30 jours pour les diagnostics et les sauvegardes privées est une **politique proposée pour le prototype**. Le contrôle des logs et la restauration SQL ont été éprouvés en environnement temporaire ; aucune purge périodique ou restauration complète des quatre stockages n'a été opérée sur les données réelles. Les anciens fichiers sans propriétaire fiable, 17 images suivies par Git, d'éventuels orphelins, HTTP sur le LAN et une revue juridique/accessibilité restent à traiter. Les images doivent encore être essayées sur l'appareil de démonstration après redémarrage des services. [Procédure et limites](../PREPARATION_SOUTENANCE.md#activation-locale-des-corrections-et-cycle-de-vie).

Ne pas annoncer une conformité RGPD complète. Pour renforcer cette preuve, consigner une vérification sur appareil, inventorier les sauvegardes réelles et faire revoir le traitement de l'historique avant toute purge.
