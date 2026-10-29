# Catalogue de vêtements et deux couleurs — version 3

Implémentation du 29/10/2026. **Migration appliquée à la base locale le 29/10/2026 après autorisation explicite et sauvegarde privée.** Le mode deux couleurs reste conditionné à `FITS_WARDROBE_V3=1` au démarrage du backend. Aucun entraînement applicatif déclenché par cette opération. Les tests automatisés utilisent des données fictives et des stockages temporaires.

## Comportement

Le sélecteur et les filtres présentent six groupes : **Hauts, Pulls et sweats, Vestes et manteaux, Bas, Chaussures, Accessoires**. Un groupe « Autres pièces » préserve les types historiques non classables. Ces groupes sont calculés à partir du type et de sa zone ; les trois familles relationnelles existantes restent en base. Un cardigan appartient au torse, une veste à l'extérieur : leur comportement de superposition reste distinct.

La migration propose 30 types précis (polo, cardigan, sweat zippé, blazer, jean, bottines, etc.), sans déplacer, renommer ou supprimer les anciennes sous-catégories. Des intitulés historiques plus larges peuvent donc coexister avec les nouveaux types. Les zones accessoires manquantes sont ajoutées comme facultatives, une pièce par zone ; les zones existantes ne sont pas modifiées. Les types ne décrivent pas les marques ou la coupe.

La palette passe de 12 à **18 couleurs** : ajout de bleu marine, kaki, bordeaux, écru, argenté et doré. Le vêtement conserve `couleur` comme couleur principale obligatoire ; `couleur_secondaire` est facultative, différente, et se retire avec `null`. Au maximum deux couleurs. La validation s'applique aux créations et modifications, y compris administrateur. Les autorisations existantes restent applicables.

L'API authentifiée `GET /api/categorie/options` annonce groupes, types, palette et `max_colors`. Le mobile ne propose les deux couleurs qu'après cette annonce. Serveur ancien ou indisponible : contrat à une couleur et ancien catalogue de secours. Le dressing trouve une pièce par l'une ou l'autre couleur et affiche deux pastilles. La reconnaissance photo peut proposer les deux couleurs ; l'utilisateur les vérifie, ses saisies manuelles restent prioritaires. Aucun nouveau fournisseur ni dépendance.

## Données et modèle

- Les nouveaux avis utilisent un snapshot **version 3**, avec identifiants d'articles et deux couleurs figées. Les versions 1 et 2 restent lisibles ; leurs couleurs secondaires absentes restent absentes. Même sans snapshot historique, aucune couleur secondaire actuelle n'est attribuée rétroactivement à l'ancien avis. Aucun backfill.
- L'encodeur partagé entraînement/prédiction devient **`outfit-v3-<empreinte>`**, incluant la palette dans l'empreinte. Les présences de couleurs globales/torse/jambes tiennent compte des deux couleurs ; la couleur dominante des associations haut/bas reste la principale. Chaque sous-catégorie du catalogue courant est encodée, jusqu'à 128 emplacements (16 minimum), au lieu de 16 auparavant. Le nombre de features n'est donc plus fixé à 85. L'ordre et la version dépendent du catalogue.
- Le scoreur reste **la même régression logistique L2 `items-pairs-v1`**, avec articles et paires ; aucun changement d'algorithme ni de seuil d'entraînement (20 avis, cinq par classe). Le RF de référence reste inchangé.
- Le nouveau modèle va dans **`user_<id>_outfit_v3.joblib`**, dans le stockage articles/paires existant. `user_<id>.joblib` reste intact. Une ancienne version n'est jamais appliquée silencieusement aux nouvelles features. Jusqu'au nouvel entraînement admissible : fallback explicite, puis ratio de favoris côté Node. Le réentraînement habituel après un avis peut ensuite créer/remplacer le modèle **v3 de ce compte**.
- Même verrou par utilisateur pour v2/v3, écriture atomique et conservation du modèle en cas d'échec. La suppression du compte enlève les deux artefacts et conserve le marqueur empêchant un entraînement tardif.
- Le générateur compte les deux couleurs dans sa limite souple de deux accents ; écru et bleu marine rejoignent les neutres. Une zone obligatoire reste prioritaire si aucune alternative compatible n'existe. Ces règles sont heuristiques ; elles ne démontrent aucun gain prédictif.
- L'export interactions et l'évaluation hors ligne acceptent v3. Le rapport prospectif inclut les nouveaux snapshots et sépare les résultats par `feature_version`. Ne pas confondre ou comparer sans protocole des métriques obtenues avant/après ce changement de représentation.

## Activation locale après validation

1. Arrêter Node pour éviter des écritures pendant l'opération ; contrôler la cible PostgreSQL locale et effectuer une sauvegarde privée. Ne pas utiliser une base de production. Vérifier les trois familles `Vêtements`, `Chaussures`, `Accessoires`, et les zones `torse`, `jambes`, `pieds`, `exterieur`, `tete`. Une famille absente/ambiguë ou une zone requise absente provoque l'annulation de la migration. Adapter les paramètres ci-dessous à l'utilisateur PostgreSQL local ; ne pas mettre un mot de passe dans la commande ou Git.

   ```sh
   # Depuis backend ; exemples à compléter, pas exécutés par Codex.
   pg_dump -h 127.0.0.1 -p 5432 -U <utilisateur_SQL> -d fits -Fc -f <sauvegarde_privee_hors_depot.dump>
   psql -h 127.0.0.1 -p 5432 -U <utilisateur_SQL> -d fits -v ON_ERROR_STOP=1 -f migrations/20261029_wardrobe_v3.sql
   ```

2. Redémarrer les services Python avec leur code mis à jour (`npm run ml:services` depuis backend). Aucun nouveau secret ou dossier ML à configurer.
3. Lancer Node avec **`npm run dev:v3`** (équivalent à `FITS_WARDROBE_V3=1 npm run dev`) depuis backend. Ce drapeau doit également être fourni aux futurs scripts d'export si l'on souhaite exporter en v3. Il ne remplace pas l'application préalable de la migration. Ne pas activer/désactiver ce réglage sans redémarrer Node.
4. Recharger Expo et rouvrir la fiche vêtement. Vérifier sur un compte de test : choix d'un type, principale/secondaire, enregistrement, réouverture, filtre sur la secondaire, retrait de celle-ci, génération puis avis. Un avis écrit et peut entraîner le modèle de ce compte.

**Retour arrière sans perte de données :** arrêter Node et le relancer sans `FITS_WARDROBE_V3=1`, recharger le mobile. La colonne et le catalogue ajoutés restent en base ; les secondes couleurs et modèles v3 sont conservés mais ne sont plus utilisés. Ne pas supprimer la colonne ou les nouvelles catégories une fois utilisées. L'extension du catalogue change aussi l'empreinte v2 : le retour arrière peut donc produire un fallback `incompatible_model` jusqu'à un entraînement compatible ; il ne garantit pas la réutilisation immédiate de l'ancien modèle. Une restauration exacte relève de la sauvegarde et doit tenir compte des écritures intervenues depuis. Aucun script destructif de rollback n'est fourni.

## Vérifications

Tests ciblés : deux couleurs valides/invalides, contrat legacy, reconnaissance simulée, filtres, snapshots, schémas stables, catégories après les seize premières, modèle personnel, conservation v2/v3 et effacement. Les tests isolés exécutent la migration deux fois dans un nouveau cluster PostgreSQL, contrôlent les anciennes lignes, puis vérifient l'annulation transactionnelle si une famille manque. Le parcours navigateur utilise une API fictive et bloque le réseau externe.

À vérifier manuellement après activation : ergonomie du choix de deux couleurs sur iOS/Android, analyse d'une vraie photo bicolore et adéquation des nouveaux types au dressing réel. Ces tests fonctionnels ne constituent pas une mesure de qualité du modèle.

Résultats du 29/10/2026 : **228 tests backend, 95 tests mobile, 54 tests Python et 12 scénarios d'intégration isolée réussis**. ESLint et export web Expo réussis. Parcours Chrome fictif : aucune erreur navigateur ; choix du groupe, des deux couleurs, contrôle du corps envoyé et retour au dressing vérifiés.

Commandes de reproduction, depuis leurs dossiers respectifs :

```sh
# backend — aucun .env chargé par Jest
ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm test -- --runInBand
# backend — fournir un mongod local ou préparé avec scripts/prepareMongoTestTool.py
FITS_TEST_MONGOD=<chemin_vers_mongod> ML_TEST_PYTHON=/opt/anaconda3/bin/python3 npm run test:isolated
# mobile
../backend/node_modules/.bin/jest --runInBand tests
npm run lint
# ml-service
PYTHONDONTWRITEBYTECODE=1 /opt/anaconda3/bin/python3 -m unittest discover -s tests -v
```

Le lanceur isolé force le mode historique pour les tests existants ; le fichier `wardrobeV3.test.js` active v3 uniquement dans son environnement Jest, sur le cluster temporaire du lanceur. Il ne faut pas lancer ce fichier directement contre une base de développement.

## Application à la base locale — 29/10/2026

Migration appliquée sur `fits`, PostgreSQL 14.20 Homebrew, serveur local contrôlé. Le seed utilise la zone `sac` déjà présente, pour ne pas créer un second emplacement concurrent pour les sacs. Catalogue après migration : trois familles SQL, dix zones et 49 sous-catégories. Les six groupes mobiles restent dérivés de ces familles/types/zones.

Sauvegarde privée antérieure : `backend/private/backups/fits-before-wardrobe-v3-2026-10-29T00-02-55-691Z.dump`, avec manifeste voisin, permissions restreintes et exclusion Git vérifiée. Format et contenu de la liste d'archive contrôlés avec `pg_restore --list`, empreinte SHA256 enregistrée ; aucune restauration complète de cette sauvegarde réelle n'a été effectuée. L'expiration indicative à 30 jours dans le manifeste ne constitue pas une purge automatique.

Pendant la sauvegarde et la migration, des verrous transactionnels ont empêché les écritures concurrentes sur les tables concernées. Les empreintes avant/après des comptes, dressings, vêtements (hors nouvelle colonne), liens, tenues, compositions et évaluations sont identiques. Chaque ancienne ligne des catalogues est conservée. Les contrôles ont été effectués avant `COMMIT`. La colonne `couleur_secondaire` est nullable ; aucune ancienne pièce n'a été recolorée.

Après migration : les trois comptes possédant des vêtements renvoient HTTP 200 sur `GET /api/dressing/me` ; le catalogue annonce les six groupes. Le backend a ensuite été relancé avec `npm run dev:v3` : l’API annonce maintenant deux couleurs et 18 choix ; les trois dressings testés répondent toujours HTTP 200. Pour les prochains démarrages, utiliser cette même commande. Le service ML en cours accepte déjà le schéma v3 : vérification par une requête de validation invalide, sans prédiction, entraînement ou accès à un artefact. Aucun vote ni vêtement fictif n'a été ajouté à la base locale.

Ergonomie : sélection directe de deux pastilles, toutes deux mises en évidence et numérotées ; toucher une pastille sélectionnée la retire. Une troisième couleur est refusée avec une indication explicite, sans perte des deux choix. Le formulaire recharge ses capacités à chaque retour au premier plan de la navigation.

Correction du sélecteur le 29/10/2026 : 99 tests mobile réussis, dont sélection simultanée des deux pastilles, refus de la troisième, promotion de la secondaire après retrait de la principale et rechargement des options au retour sur la fiche. Lint et export web réussis. Aucun entraînement ni nouveau vote réel déclenché par cette correction.
