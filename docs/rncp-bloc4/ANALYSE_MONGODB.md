# FITS — C4 : MongoDB dans l'architecture réelle

**Conclusion :** MongoDB est utilisé pour les journaux d'authentification et une seconde voie de stockage photo, mais **n'alimente pas le Machine Learning**. Pour les volumes actuels, ce stockage hybride apporte de la souplesse documentaire tout en ajoutant des obligations de maintenance et de suppression. Il n'est pas nécessaire de le développer davantage avant l'oral.

## Collections et opérations observées dans le code

| Collection Mongoose / MongoDB | Structure prévue par le modèle | Écritures et lectures applicatives | Lien SQL / ML |
|---|---|---|---|
| `Log` → `logs` | `userId` texte, `action`, `details` objet libre, `date` | `logAction` crée un document lors de l'inscription et des connexions réussies ou échouées. Les anciens `details` peuvent inclure e-mail et IP ; le code actuel n'ajoute plus ces champs aux nouveaux logs d'authentification. Aucune route de consultation des logs n'a été trouvée. | `userId` n'est pas une FK SQL ; les logs ne sont pas lus par l'ETL ou Python. |
| `Photo` → `photos` | `ownerUserId` numérique pour les nouveaux documents, `filename`, `data` binaire BSON, `contentType`, `createdAt` | `POST /api/photo/upload` enregistre l'ID issu du JWT ; `GET /api/photo/:id` filtre par identifiant **et** propriétaire, sinon 404. Cette voie n'est pas appelée par les écrans mobiles inspectés. | Anciens documents potentiellement sans propriétaire ; aucune relation garantie avec `vetement.photo` ; pixels non exploités par le ML. |

Le mobile appelle `POST /api/upload`, qui écrit plutôt dans `backend/uploads` et renvoie une URL utilisée par `vetement.photo` en PostgreSQL. Les **deux voies photo coexistent** ; MongoDB n'est donc pas le stockage unique des images. Le pipeline ML lit `evaluation`, `tenue`, `composer`, `vetement` et le catalogue SQL, puis écrit des Joblib sur disque. Il ne requiert aucune lecture MongoDB pour entraîner ou prédire.

## Mesures en lecture seule

`backend/scripts/diagnoseMongo.js` a interrogé la base **distante** `fits` le 13/10/2026. Son statut environnemental n'est pas établi par le nom de la base : ces chiffres ne sont pas qualifiés de production. Le script ne lit aucun corps de log ou octet d'image. Il a pu lister les collections, obtenir `collStats` et les index ; cela prouve un accès de lecture à ces métadonnées, **pas** que le compte applicatif suit le moindre privilège.

| Collection | Documents | Taille logique | Taille allouée | Index alloués | Index constatés |
|---|---:|---:|---:|---:|---|
| `logs` | **233** | 35 360 octets | 45 056 octets | 36 864 octets | `_id_` uniquement |
| `photos` | **1** | 9 873 octets | 53 248 octets | 36 864 octets | `_id_` uniquement |

L'index `_id_` est unique par construction MongoDB et couvre la recherche d'une photo par identifiant ; le filtre de propriétaire est vérifié ensuite sur cet unique document. Il n'existe pas d'index observé sur `logs.date`, `logs.userId` ou `logs.action`, mais le code **n'exécute aucune recherche de logs** : en ajouter maintenant n'a pas de bénéfice mesuré. Il n'y a pas d'index TTL observé ; la conservation des journaux paraît illimitée en l'absence de politique applicative identifiée.

Une mesure de **cinq `findOne({_id}, projection {_id:1})`** sur l'unique photo donne **7,377 à 142,042 ms**, médiane **8,232 ms**. Cette mesure inclut l'aller-retour vers MongoDB distant et un pic réseau ; elle **n'inclut ni le transfert binaire, ni l'API Express, ni l'affichage mobile**. Elle n'est pas un benchmark de téléchargement d'image. Les écritures de log et de photo n'ont pas été chronométrées car elles auraient modifié les données.

## Protection, cohérence et conservation

Les routes d'upload et de lecture photo Mongo exigent un JWT, et l'upload contrôle taille et signature initiale des types JPEG/PNG/WebP. Depuis le correctif C3, une nouvelle photo porte l'ID de son propriétaire et la lecture est refusée à un autre compte. Les anciennes photos sans propriétaire vérifiable reçoivent aussi 404 ; elles n'ont été ni modifiées ni supprimées. La voie disque `/uploads` reste lisible publiquement pour préserver les URL mobiles existantes. Voir `SECURITE_UPLOADS.md` pour les limites exactes.

La suppression de compte dans `utilisateurController.deleteMe` détruit l'utilisateur SQL, mais **ne supprime explicitement ni ses journaux MongoDB, ni ses photos, ni ses fichiers Joblib et images disque**. L'identifiant texte des logs n'a aucune cascade SQL. La voie photo Mongo renvoie un ID sans transaction avec `vetement.photo`, ce qui peut laisser un document orphelin ou un lien cassé si une opération échoue. Le statut et la durée de conservation des données personnelles doivent être décidés avant une promesse de suppression complète ou de conformité RGPD. Aucune donnée existante n'a été supprimée dans cette analyse.

**Bilan SQL/NoSQL.** PostgreSQL protège les relations métier, l'unicité de l'avis et les transactions nécessaires au parcours de tenue ; JSONB y accueille déjà le snapshot souple utile au ML. MongoDB permet des journaux `details` flexibles et des documents photo binaires, mais impose une connexion distante supplémentaire, deux mécanismes de sauvegarde/sécurité, et une cohérence inter-stockages non transactionnelle. À **233 logs et une photo**, un gain opérationnel de MongoDB face à un stockage unifié n'est pas démontré. Garder l'architecture actuelle pour l'oral évite une migration inutile ; une consolidation éventuelle se déciderait après besoins de rétention, coûts et charge réels.

## Reproduction et preuve orale

```sh
cd '/Users/kojiro/Documents/Cours Dev/fits/backend'
node scripts/diagnoseMongo.js
```

Le script vérifie que l'URI cible la base `fits` et refuse `NODE_ENV=production`. Il n'affiche ni l'URI, ni l'hôte, ni les `_id`, ni les `details` ou les images. Il utilise `listCollections`, `collStats`, `listIndexes` et, si une photo existe, cinq lookups `_id` avec projection du seul identifiant. Une indisponibilité de `collStats` est signalée ; elle ne doit pas être transformée en valeur zéro. Les tests `backend/tests/diagnosticScripts.test.js` vérifient les garde-fous et l'absence de contenu photo dans la réponse.

**PowerPoint :** une petite case « MongoDB : 233 logs, 1 photo, hors ML » sur le schéma des sources suffit. Question probable : « Pourquoi deux bases ? » Réponse : les transactions et FK pour le métier en PostgreSQL, la souplesse des documents pour les journaux ; à cette échelle, le coût de complexité est réel et le bénéfice non prouvé. Question : « Peut-on supprimer toutes les données d'un utilisateur ? » Réponse : pas encore de bout en bout ; les cascades SQL existent, mais Mongo, Joblib et images demandent une politique et une orchestration de suppression.
