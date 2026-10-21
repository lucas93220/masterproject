# Application mobile FITS

Application React Native/Expo du parcours dressing → génération de tenue → like/dislike. À la création et à la modification d'un vêtement, une couleur principale se choisit dans une palette de 12 couleurs ; les anciennes valeurs libres doivent être remplacées lors d'une modification depuis cet écran.

```sh
cd mobile
npm ci
npm start
```

Le projet utilise `App.js` et `src/navigation`, **pas** Expo Router. Pour un téléphone physique, le Mac qui héberge l'API et le téléphone doivent pouvoir communiquer sur le même réseau. En développement local, `src/services/api.js` reprend l'hôte LAN indiqué par Expo et utilise le port Node `3002` ; redémarrer Expo si le Mac change de réseau. Si Expo ne fournit pas d'hôte LAN utilisable, l'adresse locale de secours est `192.168.1.17`. On peut définir `EXPO_PUBLIC_API_URL` dans `mobile/.env.local` pour une autre adresse complète, par exemple `http://<adresse-du-Mac>:3002/api` ; ce fichier est ignoré par Git et ne doit contenir aucun secret. Un tunnel Expo ne rend pas l'API Node accessible à lui seul. L'écran de connexion distingue maintenant un refus d'identifiants d'une panne réseau ou du serveur.

Avant la démonstration, démarrer aussi PostgreSQL, le backend Node et le service Python avec le même `ML_SERVICE_SECRET` dans l'environnement de ces deux services. Tester connexion, ajout de vêtement, image et génération. Les actions manuelles de vote écrivent des avis et peuvent entraîner le modèle personnel du compte utilisé ; les commandes de démonstration isolée et les limites sont dans `../docs/rncp-bloc4/PREPARATION_SOUTENANCE.md`.

Les images `/uploads` requièrent désormais un JWT et le bon propriétaire. `ClothingImage` transmet le jeton uniquement à l'origine de l'API ; sur le web, l'image est téléchargée avec authentification puis affichée via une URL blob temporaire. Sur iOS/Android, les en-têtes sont portés par la source native. Une ancienne image sans relation au dressing/à une tenue reste inaccessible ; aucune photo existante n'a été supprimée par ce changement. Mettre à jour le mobile et redémarrer Node ensemble pour éviter des images refusées sur un ancien client.

Tests isolés, depuis `mobile` après `npm ci` dans les deux dossiers : `../backend/node_modules/.bin/jest --runInBand tests`. Ils simulent les composants natifs : vérifier aussi les photos sur le téléphone/navigateur réel. L'état technique et les preuves sont dans `../docs/rncp-bloc4/ETAT_ACTUEL.md`.

L’interface partage ses composants dans `src/components/ui.js` et ses couleurs/typographies dans `src/styles`. Le dressing propose une recherche par nom ou marque, des filtres combinables (catégorie, couleur, favoris), un tri local et une actualisation par glissement. Les photos s’affichent entières ; sur l’accueil, un appui ouvre l’aperçu. Les filtres du dressing ne changent pas les recommandations. Les formulaires conservent les contrats API, affichent les valeurs existantes et bloquent les doubles soumissions. Le retrait d’un vêtement est aussi accessible dans sa fiche, avec confirmation.

À l’ajout, les indications thermiques sont estimées depuis le libellé de sous-catégorie (`src/services/thermalDefaults.js`), sans saisie obligatoire. Ce sont des heuristiques initiales, pas des mesures scientifiques de confort : par exemple, un manteau est disponible jusqu’à 12 °C et un short à partir de 18 °C. Les hauts de base restent disponibles dans le froid pour la superposition ; leur minimum n’est pas une recommandation de les porter seuls. Les règles existantes du générateur continuent à composer les couches. Une catégorie inconnue utilise une plage générale explicite et ajustable. Les estimations sont définies dans le mobile et envoyées dans les champs API existants, sans migration ni modification du moteur ML.

« Ajuster les températures » ouvre le réglage manuel facultatif, qui reste prioritaire même après un changement de catégorie. En modification, les températures enregistrées sont conservées par défaut ; seul « Utiliser l’estimation automatique » les remplace lors de l’enregistrement. Aucun vêtement existant ni snapshot historique n’est recalculé automatiquement. Le mode automatique n’est pas enregistré comme un nouveau champ : à la réouverture d’une fiche, les valeurs sauvegardées deviennent son réglage conservé. Les valeurs par défaut devront être ajustées au retour des essais, notamment pour les catégories regroupant des épaisseurs différentes.

Contrôle visuel reproductible sur macOS, avec Chrome et Node 24, **sans les services FITS** :

```sh
# Depuis mobile ; utiliser les dépendances déjà installées.
CI=1 EXPO_NO_TELEMETRY=1 ./node_modules/.bin/expo export --platform web --output-dir /private/tmp/fits-ui-web
node scripts/smokeUi.cjs /private/tmp/fits-ui-web
```

Ce parcours démarre un serveur sur loopback et un profil Chrome temporaire, remplace l’API par des fixtures et bloque les requêtes externes de l’application. Il contrôle connexion, génération/avis, aperçu, dressing/filtres, ajout/modification/catégories et profil. Les captures fictives sont écrites dans le dossier temporaire indiqué ; le profil Chrome est supprimé à la fin. Il ne remplace pas l’essai sur appareil : photothèque et permissions, clavier, VoiceOver/TalkBack, grandes polices, images privées réelles et sauvegarde sur un compte de test restent à vérifier.

Le web est exporté comme application monopage React Navigation. L’ancienne configuration Expo Router inutilisée et la référence au favicon vide ont été retirées. Les autres fichiers d’icônes natifs du dépôt sont encore vides : les exports de bundles ne valident pas l’habillage d’un binaire destiné aux stores.
