# Application mobile FITS

Application React Native/Expo du parcours dressing → génération de tenue → like/dislike.

```sh
cd mobile
npm install
npm start
```

Le projet utilise `App.js` et `src/navigation`, **pas** Expo Router. Pour un téléphone physique, le Mac qui héberge l'API et le téléphone doivent pouvoir communiquer sur le même réseau. L'adresse de l'API est actuellement fixée dans `src/services/api.js` ; la vérifier et la modifier si le Mac change de réseau, puis recharger l'application. Un tunnel Expo ne rend pas l'API Node accessible à lui seul.

Avant la démonstration, démarrer aussi PostgreSQL, le backend Node et le service Python avec le même `ML_SERVICE_SECRET` dans l'environnement de ces deux services. Tester connexion, ajout de vêtement, image et génération. Les actions manuelles de vote écrivent des avis et peuvent entraîner le modèle personnel du compte utilisé ; les commandes de démonstration isolée et les limites sont dans `../docs/rncp-bloc4/PREPARATION_SOUTENANCE.md`.

Tests mobiles isolés : les scénarios sont dans `tests/`. Le dossier RNCP résume l'état technique dans `../docs/rncp-bloc4/ETAT_ACTUEL.md`.
