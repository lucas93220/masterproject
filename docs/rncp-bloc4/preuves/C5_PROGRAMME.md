# C5 — Programme d'IA et démonstration

**Critère de la grille validée :** schématiser et concevoir une solution d'IA répondant aux fonctions prévues.

## Parcours vérifiable

1. Le [mobile](../../../mobile/src/screens/home.js) demande une tenue à partir du dressing, de la température et du code d'icône météo.
2. [Node](../../../backend/controllers/tenueController.js) applique les règles de cohérence et compose jusqu'à cinq candidats ; par temps froid, une couche extérieure disponible est conservée et un t-shirt peut se placer sous une chemise. Les lunettes de soleil exigent un ciel dégagé ou peu nuageux de jour selon les [codes OpenWeather](https://openweathermap.org/weather-conditions). [outfitFeatures.js](../../../backend/services/outfitFeatures.js) encode ensuite les 85 colonnes inchangées.
3. [Python](../../../ml-service/app.py) sélectionne le modèle de l'utilisateur identifié par Node, ou répond par un fallback explicite ; [rankCandidates.js](../../../backend/services/rankCandidates.js) classe les candidats. En cas de panne ML, tout le lot utilise la même règle de secours.
4. Le mobile attend l'écriture du like/dislike avant une autre génération ; [Node](../../../backend/controllers/evaluationController.js) fige un snapshot puis déclenche le réentraînement personnel.

Le [test d'intégration isolé](../../../backend/tests/isolated/pipeline.test.js) traverse les vrais endpoints Node et FastAPI, avec PostgreSQL et MongoDB temporaires : génération, vote, snapshot, dataset, deux modèles distincts, prédiction, panne et fallback. La [démo Python isolée](../../../ml-service/demo_isolated.py) utilise des données fictives et des modèles temporaires. La vérification finale documentée du 14/10/2026 compte **211 tests réussis** sur backend, intégration isolée, Python et mobile ; les commandes sont dans le [guide pratique](../PREPARATION_SOUTENANCE.md#démo-isolée-et-tests-sûrs).

## Limites et preuve à compléter

Ces essais prouvent l'exécution du parcours, **pas** la qualité des recommandations ni un accord de niveau de service. Jusqu'à cinq appels de prédiction peuvent être séquentiels ; la latence complète mobile et la disponibilité réelle ne sont pas mesurées. Sur un autre réseau, l'IP LAN fixe du mobile doit être adaptée. Répéter connexion, images, génération, vote et fallback sur l'appareil et le réseau de l'oral ; garder la sortie isolée comme secours. [Ordre de présentation](../SOUTENANCE.md).
