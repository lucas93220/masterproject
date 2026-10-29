# Préremplissage depuis une photo

Le préremplissage démarre automatiquement après le choix d’une photo dans le formulaire mobile. La photo est transmise à Google Gemini pour cette analyse. Aucun bouton supplémentaire n’est nécessaire ; un bouton de réessai apparaît seulement après une erreur. Une sélection annulée ou reçue après fermeture de la fiche ne déclenche aucun envoi. Aucun appel payant n’est relancé automatiquement après un échec.

Les suggestions remplissent uniquement les champs non saisis ; les corrections manuelles et les valeurs d’une fiche existante restent prioritaires. Une autre photo remplace les anciennes propositions non corrigées. L’utilisateur vérifie les informations puis enregistre normalement. Ni la sélection ni l’analyse ne créent un vêtement en base.

Les propositions sont le nom (marque et modèle commercial lorsqu’ils sont reconnus), la marque, la couleur principale, une seconde couleur facultative en mode v3 et une sous-catégorie du catalogue réel. La catégorie utilise l’estimation thermique existante ; la photo ne mesure pas le confort thermique. La marque peut rester vide. Le modèle de recommandation, ses features, ses votes et son entraînement ne sont pas modifiés.

## Activation

1. Créer une clé dans [Google AI Studio](https://aistudio.google.com/apikey). Vérifier les [conditions de traitement des données](https://ai.google.dev/gemini-api/terms), quotas et facturation du compte avant d’envoyer de vraies photos.
2. Ajouter les variables de [.env.vision.example](.env.vision.example) au fichier privé `backend/.env`, sans remplacer ses valeurs existantes. Renseigner `GEMINI_API_KEY` uniquement dans ce fichier, jamais dans le mobile, le chat, les logs ou Git.
3. L’adaptateur est sélectionné par `CLOTHING_VISION_PROVIDER=gemini`. `CLOTHING_VISION_MODEL` permet de changer de modèle compatible images/JSON sans modifier le mobile. La valeur initiale est `gemini-3.5-flash-lite` : vérifier sa disponibilité dans le compte. Un autre fournisseur demandera un adaptateur backend, pas une simple URL.
4. Redémarrer Node depuis `backend` avec `npm run dev:v3` (base migrée), puis recharger le mobile. Aucune migration ni modification du service ML n’est nécessaire.

Sans clé ou en cas d’échec, une erreur explicite laisse l’ajout manuel disponible. Aucun fichier contenant des secrets existants n’a été modifié pour cette intégration.

## Contrat et garde-fous

`POST /api/clothing-analysis` : JWT obligatoire, multipart avec un seul champ fichier `image`, JPEG/PNG/WebP, 5 Mio maximum. Le backend contrôle type et signature, puis transmet les octets par HTTPS, sans URL publique ni identifiant utilisateur dans la requête fournisseur. Il ne journalise ni la photo, ni la réponse brute, ni l’erreur Axios contenant la clé.

Le fichier reste en mémoire le temps du traitement, sans écriture en SQL, MongoDB ou `uploads`, et sans utiliser la Files API du fournisseur. Cela ne garantit pas l’absence de conservation ou d’utilisation par Google : les conditions du compte doivent être examinées. Les métadonnées ne sont pas explicitement supprimées par cette première version. Utiliser une photo centrée sur une seule pièce, sans personne ni détail privé. La photo n’est sauvegardée par FITS que lors de l’enregistrement habituel du vêtement.

La réponse contient `suggestion` avec `nom`, `marque`, `couleur`, `id_sous_categorie`, `nom_sous_categorie`, ainsi que `couleur_secondaire` en mode v3. Les valeurs incertaines sont `null`. Seules les couleurs autorisées par le mode actif (18 en v3, 12 en mode historique) et les sous-catégories existantes sont retenues ; rien n’est créé dans le catalogue. La marque est retenue si le fournisseur indique un logo/une étiquette visible ou un design caractéristique (`brand_basis=distinctive_design`). Un modèle est intégré au champ `nom` uniquement avec une marque retenue et `model_identified=true` ; sinon le nom descriptif est conservé. Ces indications expriment le jugement du fournisseur, pas une probabilité calibrée ni une vérification catalogue. Un format JSON valide ne garantit pas une reconnaissance juste : l’utilisateur reste responsable de la vérification.

Statuts : `401` session, `400` fichier absent/multipart invalide, `413` taille, `415` format, `422` photo non exploitable, `429` quota local, `502` réponse illisible/incomplète, `503` configuration/catalogue/fournisseur indisponible, `504` délai fournisseur dépassé. Timeout fournisseur 30 s, attente client 45 s ; aucun nouvel appel payant n’est relancé automatiquement.

Limites initiales : **20 analyses par compte sur une heure**, **200 globalement sur 24 heures**, **deux traitements simultanés**. Les demandes admises sont comptées même si elles échouent ensuite ; les refus de fichier/configuration ne consomment pas ce quota. Compteurs en mémoire, réinitialisés au redémarrage : avant plusieurs instances ou une ouverture publique, prévoir un compteur partagé, un budget/quota chez le fournisseur et une notice adaptée. Ce garde-fou local n’est pas un plafond garanti de facturation.

## Tests et contrôle manuel

Depuis `backend` :

```sh
./node_modules/.bin/jest --runInBand tests/clothingAnalysis.test.js tests/imageUploadRoutes.test.js
```

Depuis `mobile` :

```sh
../backend/node_modules/.bin/jest --runInBand tests/clothingForm.test.js tests/apiUpload.test.js
```

Ces tests simulent Gemini et les bases : aucune donnée réelle ou photo n’est envoyée. Ils vérifient suggestions, contrôles, erreurs, quota, concurrence, corrections et sauvegarde après validation, pas la précision réelle de reconnaissance.

Après configuration, essayer une photo non sensible, vérifier les champs, corriger une proposition puis enregistrer sur un compte de test. Essayer aussi une marque illisible, une autre photo et une image sans vêtement. L’analyse réelle transmet la photo et peut être facturée ; aucune n’a été déclenchée par les tests.

Références : [images](https://ai.google.dev/gemini-api/docs/image-understanding), [generateContent](https://ai.google.dev/api/generate-content), [sorties structurées](https://ai.google.dev/gemini-api/docs/structured-output).

Vérification du 29/10/2026 après automatisation : 102 tests mobile réussis, lint et export web réussis. Les tests vérifient notamment le lancement dès la sélection, l’annulation sans envoi, le blocage des doubles demandes, le réessai explicite, la conservation des champs saisis et l’absence d’application d’une réponse tardive. Aucun appel réel à Gemini n’a été effectué par ces tests.


## Identification des modèles — 29/10/2026

La reconnaissance peut désormais s’appuyer sur la silhouette, les empiècements, le laçage et la semelle, même sans logo visible. La consigne distingue un design caractéristique d’une ressemblance générique et considère une paire de chaussures comme un seul article. Elle demande de ne pas forcer une référence ou un coloris commercial incertain. Un seul appel fournisseur est effectué ; aucune recherche Internet ou catalogue n’a été ajoutée. Le modèle Gemini configuré reste inchangé.

Le formulaire existant reçoit les mêmes champs API et préremplit automatiquement le nom, la marque, les couleurs et la catégorie disponibles. Les valeurs déjà saisies ou enregistrées restent prioritaires et les champs demeurent modifiables. Une information non identifiée peut encore nécessiter une saisie manuelle ; aucune identification exhaustive n’est garantie.

Validation automatisée : **246 tests backend et 108 tests mobile réussis**. Les nouveaux cas couvrent une marque reconnue sans logo, un modèle incertain, une marque inconnue, l’absence de répétition de marque dans le nom et la correction manuelle du résultat prérempli. Les réponses Gemini sont simulées : ces résultats ne mesurent pas sa précision réelle.

Pour comparer la reconnaissance réelle, fixer avant les essais un lot de photos dont la marque et la référence sont connues (par exemple Yeezy, Timberland, Puma atypiques et pièces génériques). Réutiliser exactement les mêmes photos, le même modèle fournisseur et le même catalogue pour les deux versions, sans corriger les réponses avant de les noter. Rapporter séparément marque correcte, modèle exact correct, information absente et référence erronée ; conserver tous les essais. Si les sorties précédentes ne sont pas disponibles, ne pas annoncer de gain avant/après : cette session constitue le premier relevé. Les appels réels transmettent les images au fournisseur et peuvent être facturés.
