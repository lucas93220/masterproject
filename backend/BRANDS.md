# Catalogue de marques FITS

Le champ Marque est un sélecteur avec recherche, noms proposés et option **Sans marque**. Le principe s’inspire du parcours documenté par [Vinted](https://www.vinted.lu/help/47?access_channel=hc_topics) : liste, recherche et possibilité de saisir une marque manquante. Le catalogue de Vinted n’est pas importé, extrait ni interrogé ; aucune dépendance à leur service n’est ajoutée.

## Origine et enrichissement

- Le fichier [clothingBrands.json](data/clothingBrands.json) contient une sélection initiale, non exhaustive, de **157 noms de marques**, préparée pour FITS. Les noms sont de simples libellés, sans logo ni affiliation revendiquée. Ce n’est pas un annuaire automatiquement tenu à jour. Pour le compléter, ajouter un nom et éventuellement des alias dans ce fichier, puis redémarrer Node.
- Lors de l’ouverture du sélecteur, le backend lit les marques des vêtements appartenant au compte authentifié et les fusionne avec ce référentiel. Les marques personnelles sont proposées en priorité ; les entrées marquées `popular` viennent ensuite. Ce drapeau est une sélection éditoriale initiale, pas une popularité mesurée parmi les utilisateurs.
- Une marque absente peut être saisie dans la recherche puis choisie via **Utiliser « … »**. Elle ne devient réutilisable dans les autres formulaires qu’après enregistrement du vêtement. Fermer le sélecteur ou quitter un formulaire sans sauvegarder ne crée aucune marque persistante.
- Les marques personnelles ne sont pas publiées dans le catalogue commun et ne sont pas partagées entre comptes. Il n’y a pas de table ou de stockage supplémentaire à effacer lors d’une suppression de compte : les suggestions personnelles sont relues depuis les vêtements, dont le cycle de vie reste celui de FITS.

Les différences de casse, d’accents et de ponctuation sont ignorées pour la recherche et la fusion. Des alias explicites permettent par exemple de retrouver `Levi's` avec `Levis` et `The North Face` avec `TNF`. Les données historiques ne sont pas renommées : un ancien libellé ou une marque reconnue depuis une photo reste affiché et sauvegardable même hors catalogue. Un choix explicite dans la liste utilise son libellé canonique. Les alias doivent être ajoutés avec prudence pour ne pas confondre deux marques ou lignes différentes.

## API et mobile

`GET /api/brands`, session JWT requise :

```json
{
  "brands": [
    { "name": "Nike", "aliases": [], "popular": true, "personal": false }
  ],
  "personalAvailable": true
}
```

La requête lit seulement la colonne `marque` des vêtements dont `id_utilisateur` correspond au compte authentifié. L’API ne renvoie pas les marques d’autres comptes. Le cache HTTP est désactivé (`private, no-store`) ; seul le formulaire garde temporairement sa liste en mémoire. Aucune frappe de recherche n’est envoyée à un fournisseur ou à l’API : le filtrage est local après le premier chargement.

Si la lecture des vêtements échoue après l’authentification, l’API fournit le catalogue commun avec `personalAvailable: false` et l’interface le signale. Le chargement côté mobile expire après dix secondes. En cas de panne complète, la marque courante, **Sans marque**, la saisie de secours et un bouton de réessai restent disponibles. Les réponses tardives après fermeture du sélecteur sont ignorées. Le clavier et le champ de recherche sont gérés dans la fenêtre de sélection.

La sauvegarde conserve le contrat existant : `marque` est une chaîne ; **Sans marque** envoie une chaîne vide. Aucun identifiant de marque, aucune migration et aucune modification du moteur ML ne sont introduits. La reconnaissance photo continue à proposer une marque visible ; une sélection manuelle reste prioritaire.

## Vérification et activation

Redémarrer le backend (`npm run dev` depuis `backend`) et recharger Expo. Aucun nouveau compte fournisseur ni clé API n’est nécessaire pour ce catalogue.

Tests isolés :

```sh
# Depuis backend, sans données réelles
./node_modules/.bin/jest --runInBand tests/brandCatalogue.test.js

# Depuis mobile
../backend/node_modules/.bin/jest --runInBand tests/clothingForm.test.js tests/apiUpload.test.js
```

Le test navigateur `mobile/scripts/smokeUi.cjs` simule aussi le catalogue et vérifie une recherche suivie d’une sélection. Sur téléphone, vérifier le clavier, le défilement, la sélection d’un nom long, une marque absente et la compatibilité avec la photo analysée. Ajouter un vêtement pour vérifier la réutilisation d’une marque personnelle écrit dans la base : le faire sur un compte de test.
