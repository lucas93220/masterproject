# C3 — ETL, qualité et protection des données

## Pipeline vérifiable

1. [Le contrôleur](../../../backend/controllers/evaluationController.js) vérifie le compte, l'appartenance de la tenue et le booléen du vote ; il fige les vêtements, leurs attributs et leurs identifiants dans un snapshot avant d'enregistrer l'avis. Le dislike est écrit avant la régénération mobile.
2. [trainingDataset.js](../../../backend/services/trainingDataset.js) extrait uniquement les avis du compte, contrôle température, composition et version du snapshot, puis construit les colonnes numériques `outfit-v2` et les labels. Pour **tous les comptes**, seuls les snapshots v2 fournissent les identités d'articles au modèle courant ; les anciens identifiants reconstruits ne sont pas utilisés pour son entraînement.
3. Node transmet le dataset au service Python avec l'identité issue de la session authentifiée. Le seuil de 20 avis et cinq par classe contrôle seulement l'admissibilité technique. [Le test isolé](../../../backend/tests/isolated/pipeline.test.js) montre notamment qu'une modification ultérieure d'un vêtement ne change pas le vote figé.

## Qualité mesurée

Le graphique [69 → 64](../visuels/qualite_avis.png) décrit **l'ancien compte**, à la date de sa collecte : cinq températures absentes, 42 likes/22 dislikes exploitables, seulement trois snapshots valides et 66 manquants. Les cinq lignes sont exclues sans température inventée. Sur l'historique sans snapshot, les attributs du dressing actuel peuvent différer de ceux du jour du vote. Ces données ne sont ni effacées ni reconstruites artificiellement.

Le **relevé du 21/10** sur le compte récent portait sur **251 avis avec snapshot v2** utilisables pour l'évaluation d'interactions ; il ne remplace pas les chiffres de l'ancien compte et ne constitue pas un total de toute la base. Les comptes restent séparés. [Rapport agrégé en lecture seule](../../../backend/scripts/reportEvaluationQuality.js) et [export privé](../../../backend/scripts/exportEvaluationDataset.js) permettent un nouveau relevé après vérification de la base ciblée. Aucune donnée individuelle ne doit être publiée avec les preuves.

## Accès, suppression et limites

L'inscription publique impose le rôle utilisateur ; uploads et images demandent une session, l'accès aux images historiques attribuables est contrôlé via SQL. Le [profil mobile](../../../mobile/src/screens/profile.js) permet la suppression avec confirmation. [accountDeletion.js](../../../backend/services/accountDeletion.js) coordonne SQL, MongoDB, images disque et Joblib personnels ; une réponse `202` signale un nettoyage encore en attente et un script de reprise existe. Les tests sur moteurs et répertoires **temporaires** couvrent effacement, isolation, échec/reprise et blocage d'un compte réintroduit par restauration SQL. Aucun compte réel n'a été supprimé pour ces preuves.

Les logs et sauvegardes privés ont une **politique proposée** de 30 jours, sans purge périodique opérée sur l'environnement réel. Une restauration complète des quatre stockages, les anciens fichiers sans propriétaire fiable, les images suivies dans l'historique Git, les sauvegardes réelles et la revue juridique restent à traiter. Le prototype LAN utilise HTTP. La suppression retire les données actives identifiables ; elle ne garantit pas l'effacement immédiat de chaque copie. Ne pas annoncer une conformité RGPD complète. [Procédure et précautions](../PREPARATION_SOUTENANCE.md#cycle-de-vie-et-points-a-verifier).
