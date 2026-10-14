# Application mobile FITS

Application React Native/Expo du parcours dressing → génération de tenue → like/dislike. À la création et à la modification d'un vêtement, une couleur principale se choisit dans une palette de 12 couleurs ; les anciennes valeurs libres doivent être remplacées lors d'une modification depuis cet écran.

```sh
cd mobile
npm ci
npm start
```

Le projet utilise `App.js` et `src/navigation`, **pas** Expo Router. Pour un téléphone physique, le Mac qui héberge l'API et le téléphone doivent pouvoir communiquer sur le même réseau. L'adresse de l'API est actuellement fixée dans `src/services/api.js` ; la vérifier et la modifier si le Mac change de réseau, puis recharger l'application. Un tunnel Expo ne rend pas l'API Node accessible à lui seul.

Avant la démonstration, démarrer aussi PostgreSQL, le backend Node et le service Python avec le même `ML_SERVICE_SECRET` dans l'environnement de ces deux services. Tester connexion, ajout de vêtement, image et génération. Les actions manuelles de vote écrivent des avis et peuvent entraîner le modèle personnel du compte utilisé ; les commandes de démonstration isolée et les limites sont dans `../docs/rncp-bloc4/PREPARATION_SOUTENANCE.md`.

Les images `/uploads` requièrent désormais un JWT et le bon propriétaire. `ClothingImage` transmet le jeton uniquement à l'origine de l'API ; sur le web, l'image est téléchargée avec authentification puis affichée via une URL blob temporaire. Sur iOS/Android, les en-têtes sont portés par la source native. Une ancienne image sans relation au dressing/à une tenue reste inaccessible ; aucune photo existante n'a été supprimée par ce changement. Mettre à jour le mobile et redémarrer Node ensemble pour éviter des images refusées sur un ancien client.

Tests isolés, depuis `mobile` après `npm ci` dans les deux dossiers : `../backend/node_modules/.bin/jest --runInBand tests`. Ils simulent les composants natifs : vérifier aussi les photos sur le téléphone/navigateur réel. L'état technique et les preuves sont dans `../docs/rncp-bloc4/ETAT_ACTUEL.md`.
