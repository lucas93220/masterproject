# Préremplissage depuis une photo

Le préremplissage démarre automatiquement après le choix d’une photo dans le formulaire mobile. La photo est transmise à Google Gemini et, si une clé SerpApi est configurée, à la recherche visuelle complémentaire. Une mention dans le formulaire décrit ces fournisseurs. Aucun bouton supplémentaire n’est nécessaire ; un bouton de réessai apparaît seulement après une erreur. Une sélection annulée ou reçue après fermeture de la fiche ne déclenche aucun envoi. Aucun appel payant n’est relancé automatiquement après un échec.

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

La réponse contient `visual_search` (`status` uniquement) ainsi que `suggestion` avec `nom`, `marque`, `couleur`, `id_sous_categorie`, `nom_sous_categorie`, ainsi que `couleur_secondaire` en mode v3. Les valeurs incertaines sont `null`. Seules les couleurs autorisées par le mode actif (18 en v3, 12 en mode historique) et les sous-catégories existantes sont retenues ; rien n’est créé dans le catalogue. La marque est retenue si le fournisseur indique un logo/une étiquette visible ou un design caractéristique (`brand_basis=distinctive_design`). Un modèle est intégré au champ `nom` uniquement avec une marque retenue et `model_identified=true` ; sinon le nom descriptif est conservé. Ces indications expriment le jugement du fournisseur, pas une probabilité calibrée ni une vérification catalogue. Un format JSON valide ne garantit pas une reconnaissance juste : l’utilisateur reste responsable de la vérification.

Statuts : `401` session, `400` fichier absent/multipart invalide, `413` taille, `415` format, `422` photo non exploitable, `429` quota local, `502` réponse illisible/incomplète, `503` configuration/catalogue/fournisseur indisponible, `504` délai fournisseur dépassé. Budget recherche visuelle 20 s (compression et requêtes comprises), timeout Gemini 30 s, attente client 75 s ; aucun nouvel appel payant n’est relancé automatiquement.

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

La reconnaissance peut désormais s’appuyer sur la silhouette, les empiècements, le laçage et la semelle, même sans logo visible. La consigne distingue un design caractéristique d’une ressemblance générique et considère une paire de chaussures comme un seul article. Elle demande de ne pas forcer une référence ou un coloris commercial incertain. Un seul appel Gemini est effectué ; la recherche visuelle complémentaire est décrite ci-dessous. Le modèle Gemini configuré reste inchangé.

Le formulaire existant reçoit les mêmes champs API et préremplit automatiquement le nom, la marque, les couleurs et la catégorie disponibles. Les valeurs déjà saisies ou enregistrées restent prioritaires et les champs demeurent modifiables. Une information non identifiée peut encore nécessiter une saisie manuelle ; aucune identification exhaustive n’est garantie.

Validation automatisée : **246 tests backend et 108 tests mobile réussis**. Les nouveaux cas couvrent une marque reconnue sans logo, un modèle incertain, une marque inconnue, l’absence de répétition de marque dans le nom et la correction manuelle du résultat prérempli. Les réponses Gemini sont simulées : ces résultats ne mesurent pas sa précision réelle.

Pour comparer la reconnaissance réelle, fixer avant les essais un lot de photos dont la marque et la référence sont connues (par exemple Yeezy, Timberland, Puma atypiques et pièces génériques). Réutiliser exactement les mêmes photos, le même modèle fournisseur et le même catalogue pour les deux versions, sans corriger les réponses avant de les noter. Rapporter séparément marque correcte, modèle exact correct, information absente et référence erronée ; conserver tous les essais. Si les sorties précédentes ne sont pas disponibles, ne pas annoncer de gain avant/après : cette session constitue le premier relevé. Les appels réels transmettent les images au fournisseur et peuvent être facturés.

## Essai séparé de recherche visuelle (SerpApi / Google Lens)

`scripts/testVisualSearch.js` teste un fournisseur tiers donnant accès aux résultats Lens. Son adaptateur est aussi utilisé par le préremplissage mobile, lorsque SerpApi est configuré ; il ne modifie pas la recommandation. Aucun catalogue local ni règle de marque n’est ajouté. Les titres des cinq premières correspondances exploitables sont des pistes, pas une identification certifiée ; aucun titre n’est copié aveuglément dans une fiche.

Créer un compte [SerpApi](https://serpapi.com/pricing) et ajouter `SERPAPI_API_KEY=...` uniquement dans `backend/.env` privé, jamais dans le chat, le mobile ou Git. Vérifier le quota du compte avant essai. Le script charge ce fichier sans afficher la clé ; pas de nouvelle dépendance. Ne pas rediriger les résultats dans un fichier suivi par Git : ils peuvent révéler les goûts et références individuels.

Depuis `backend`, sur une photo JPEG/PNG/WebP locale **de 20 Mio maximum** :

```sh
# Vérification locale : aucun appel fournisseur, aucune clé requise.
node scripts/testVisualSearch.js --image "/chemin/vers/gilet.jpg"

# Essai réel : envoi de cette photo à SerpApi pour une recherche Google Lens.
node scripts/testVisualSearch.js --image "/chemin/vers/gilet.jpg" --send
```

Sur macOS, une source dépassant les 500 Ko acceptés par SerpApi est automatiquement convertie dans une copie JPEG temporaire avec `/usr/bin/sips`, sans dépendance supplémentaire. Le script réduit progressivement la taille maximale (1600, 1280, 960 puis 640 pixels) et la qualité jusqu’à respecter la limite fournisseur. Il conserve les petites images telles quelles, ne modifie jamais le fichier original et nettoie son répertoire temporaire, y compris après erreur. Cette compression peut atténuer de petits logos ; comparer le résultat sur les pièces à identifier. Sur les autres systèmes, préparer une copie de 500 Ko maximum.

Une recherche réelle effectue un upload puis une recherche, avec délai maximal de 60 s par requête, sans réessai automatique. Elle ne publie pas les uploads privés FITS et ne démarre aucun serveur. SerpApi reçoit les octets sous un nom générique ; la recherche réutilise l’identifiant retourné, sans URL publique à héberger. Le fournisseur annonce que cet identifiant expire après dix minutes : **cela ne constitue pas une garantie d’effacement de toutes les copies ou traces**. Utiliser des photos de pièces seules, sans personne ni information privée ; les métadonnées de l’image ne sont pas retirées par cet essai. Examiner les conditions de SerpApi et Google avant une intégration utilisateur. Références techniques vérifiées le 29/10/2026 : [upload et limite de taille](https://serpapi.com/image-api), [recherche Lens](https://serpapi.com/google-lens-api).

Comparer les mêmes photos dans Gemini/FITS, dans ce script et dans Lens manuel : référence attendue connue, marque correcte, modèle exact correct, rang du bon résultat, simple ressemblance ou absence. Fixer le lot avant de lancer, conserver les échecs et ne pas rechercher avec la marque attendue comme indice. Une bonne première correspondance n’est pas encore une preuve de préremplissage automatique fiable.

Validation : `./node_modules/.bin/jest --runInBand tests/visualSearchTrial.test.js` — **12 tests réussis** avec fournisseur simulé, dont absence d’envoi sans `--send`, validation d’image, clés non divulguées, erreurs sans réessai, résultats vides et liens filtrés. Aucun résultat réel ni gain de précision n’est revendiqué à ce stade.


Compression locale : `./node_modules/.bin/jest --runInBand tests/visualSearchTrial.test.js tests/prepareVisualSearchImage.test.js` — **19 tests réussis**. Un contrôle réel de `sips` sur une image PNG synthétique de 787 252 octets a produit une copie JPEG de 470 718 octets ; l’original a été vérifié inchangé et les fixtures supprimées. Ce contrôle n’envoie rien au fournisseur et ne mesure pas la qualité de reconnaissance.


## Préremplissage intégré à l’application

Avec `SERPAPI_API_KEY` dans le `.env` backend, le complément est actif par défaut ; `CLOTHING_VISUAL_SEARCH=0` le désactive sans changer le code. Redémarrer le backend (`npm run dev:v3`) et recharger le mobile. La clé reste côté serveur. Aucun choix obligatoire ni nouvelle saisie ne sont ajoutés.

Après sélection : contrôles JWT/image/catalogue et quota, compression de la copie reçue si nécessaire, recherche Lens via SerpApi, puis un unique appel Gemini recevant la photo, le catalogue et jusqu’à cinq titres/sources/rangs. Les URL des résultats ne sont pas transmises à Gemini. Les titres sont explicitement des données non fiables ; la consigne interdit d’en suivre les instructions, de considérer le premier rang ou la majorité comme une preuve, ou de mélanger marque et modèle de résultats différents. `brand_basis=visual_search` exige un rang existant ; le serveur refuse une marque attribuée à un rang absent. Ces contrôles ne garantissent pas l’identité exacte : les pages et leurs miniatures ne sont pas consultées par Gemini.

Catégorie et couleurs restent issues de la photo. Les champs disponibles se remplissent automatiquement puis restent modifiables ; corrections manuelles et fiches existantes gardent priorité. Les correspondances ne sont plus affichées dans le formulaire : elles restent des indices internes à l’analyse, et l’utilisateur corrige directement les champs si nécessaire. Changer la photo efface les anciennes pistes ; quitter la fiche empêche l’application d’un résultat tardif.

Sans clé ou après désactivation : Gemini seul. Recherche vide : Gemini continue sans indice et le mobile le signale. Panne, compression impossible ou budget global de 20 s dépassé : Gemini seul avec message dans le formulaire. En cas d’échec Gemini, l’erreur et le réessai manuel existants restent disponibles. Aucun réessai fournisseur automatique ; attente maximale mobile 75 s.

La limite mobile reste 5 Mio par image ; le script local accepte 20 Mio. SerpApi reçoit toujours moins de 500 Ko. La compression des grandes images utilise `sips` sur macOS ; sur Linux, prévoir un convertisseur portable avant déploiement. En attendant, seules les petites images peuvent être recherchées sur les autres systèmes ; les grandes se replient sur Gemini.

Une analyse admise peut consommer un upload SerpApi, une recherche Lens et un appel Gemini. Les quotas existants couvrent tout le traitement (20 par compte/heure, 200 globalement/jour, deux traitements simultanés, compteurs par processus). Surveiller aussi le quota du compte fournisseur. Aucun résultat brut fournisseur, secret ou photo n’est journalisé ; les correspondances ne sont pas persistées dans le vêtement. Fichiers temporaires privés et nettoyés après traitement. Aucun changement de schéma ni du ML de recommandation, des snapshots ou des votes.

Tests : fournisseurs et bases simulés, choix d’un résultat autre que le premier, refus d’un rang inventé, pannes, absence de clé et résultats vides, préremplissage sans liste de pistes et sauvegarde sans sélection obligatoire. Les essais utilisateur COS/MM6 concernent le script ; la précision réelle du parcours intégré reste à vérifier dans l’application.


## Simplification et temps de préremplissage

La liste et le bouton de correspondances ont été retirés du mobile. Les titres sont toujours utilisés côté serveur pour l’identification ; seule la disponibilité de la recherche est renvoyée, sans liste ni lien. Les messages de panne ou d’absence de correspondance sont conservés. Aucun choix supplémentaire n’est demandé à l’utilisateur.

La copie JPEG déjà préparée pour SerpApi est réutilisée par Gemini lorsqu’une compression a eu lieu, même si SerpApi échoue ensuite. L’original du vêtement reste inchangé et n’est pas remplacé à la sauvegarde. Aucune conversion supplémentaire n’est ajoutée. Si la préparation échoue ou si le complément est désactivé, Gemini conserve le traitement d’origine.

Contrôle réel ponctuel sur la photo MM6 déjà utilisée, sans écriture en base : original de 4 787 236 octets, copie de 459 419 octets, préparation 117 ms. Deux appels Gemini successifs avec le même petit catalogue de contrôle et les mêmes indices connus ont pris respectivement 9 174 ms (original) et 3 074 ms (copie). La marque MM6/Margiela et une catégorie ont été reconnues dans les deux cas. Il s’agit d’un seul essai, dans cet ordre, pas d’un benchmark ni d’une garantie de précision ou de latence générale. Une tentative séparée de recherche SerpApi a dépassé son budget de 20 s ; le temps total dépend aussi du fournisseur.

Les logs `[FITS Photo]` indiquent uniquement `preparation_ms`, `recherche_ms`, `gemini_ms` et `total_ms`, y compris après erreur. Aucune photo, marque, référence, URL, identité ou clé n’y est ajoutée. Ils permettent de mesurer les prochains essais sans deviner l’origine du ralentissement. La compression peut atténuer les petits détails : vérifier les cas difficiles plutôt que généraliser cet essai.
