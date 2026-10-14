# FITS

Prototype personnel de recommandation de tenues : React Native/Expo → API Node/Express → PostgreSQL et service Python/FastAPI. MongoDB porte des journaux et une voie photo ; il n'alimente pas le modèle. Le Random Forest est personnel, avec snapshot des avis et fallback explicite.

- **État et preuves C1–C5 :** [ETAT_ACTUEL](docs/rncp-bloc4/ETAT_ACTUEL.md).
- **Tests sûrs, démonstration et protocole utilisateur :** [guide pratique](docs/rncp-bloc4/PREPARATION_SOUTENANCE.md).
- **Dossier individuel :** [REX E7B](docs/rncp-bloc4/DOSSIER_REX_E7B.md).
- **Installation mobile / ML :** [mobile](mobile/README.md), [service ML](ml-service/README.md).
- **Évaluation indépendante et limites des résultats :** [EVALUATION](ml-service/EVALUATION.md).

Installer les dépendances Node avec `npm ci` dans `backend` et `mobile`. Les secrets `.env`, images nouvelles, modèles et registres privés sont exclus de Git. Les fixtures de test sont fictives et leur génération est versionnée ; les exports de préférences réelles restent privés.

Depuis `backend`, `ML_TEST_PYTHON=/chemin/vers/python npm test -- --runInBand` lance les tests sûrs. `npm run test:isolated` crée et arrête ses propres PostgreSQL/MongoDB/FastAPI ; ses prérequis sont dans le guide. Le test historique `fits.test.js`, qui écrit dans la base configurée, est exclu de Jest par défaut.

Les résultats fonctionnels ne prouvent pas un gain prédictif : sur le compte récent mesuré, le RF reste sous la baseline majoritaire en accuracy. Aucun modèle applicatif ni donnée réelle n'est modifié par les scripts d'évaluation ou le lanceur de tests isolés.
