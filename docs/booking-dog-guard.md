# Contrôle des chiens dans la base : à appliquer via Lovable

## Le problème

Le serveur (`createBookingWithHold`) vérifie déjà que chaque chien d'une demande :
- appartient au passeport canin du voyageur ;
- a un gabarit accepté par le logement.

Mais un utilisateur connecté a aussi le droit d'écrire **directement** dans la table
`booking_requests`, sans passer par le serveur. Dans ce cas, la base vérifiait seulement le
**nombre** de chiens, pas leur gabarit ni leur propriétaire.

Il n'y aurait pas d'empreinte bancaire, mais la demande apparaîtrait chez l'hôte.

## La correction

Le fichier [`docs/sql/0009_booking_dog_guard.sql`](sql/0009_booking_dog_guard.sql) met à jour
la fonction `prepare_booking_request`, exécutée par la base avant chaque nouvelle demande.
En plus des contrôles existants, elle :

1. refuse un chien qui n'est pas dans le passeport canin du voyageur ;
2. refuse un même chien sélectionné deux fois ;
3. refuse un chien dont le gabarit **enregistré dans son passeport** n'est pas accepté par le logement ;
4. réécrit la copie des chiens stockée dans la demande à partir des passeports, ce qui empêche d'enregistrer des informations falsifiées.

Tout le reste est inchangé : logement publié, pas sa propre annonce, séjour minimum, dates,
nombre de chiens, calcul des prix, statuts.

Le comportement est identique à celui du serveur : une réservation normale depuis l'app n'est pas affectée.

## Comment l'appliquer

Les migrations de ce projet sont gérées par Lovable. N'ajoutez pas le fichier à la main dans
`drizzle/migrations/`, car Lovable tient son propre suivi des migrations.

1. Ouvrez le projet dans Lovable.
2. Collez ce message dans le chat :

   > Crée une migration qui remplace la fonction `public.prepare_booking_request()` par le SQL
   > du fichier `docs/sql/0009_booking_dog_guard.sql` du dépôt, sans rien changer d'autre.
   > Elle ajoute le contrôle des chiens (passeport du voyageur, pas de doublon, gabarit accepté
   > par le logement) et réécrit la copie des chiens à partir de `dog_profiles`.

3. Vérifiez que Lovable a repris le SQL **à l'identique** avant de valider la migration.

## Vérifier après application

1. **Réservation normale** : depuis un compte voyageur, réservez avec un chien dont le gabarit
   est accepté. La demande doit être créée comme avant.
2. **Gabarit refusé** : le serveur le bloque déjà, avec le message « Gabarit non accepté dans ce logement… ».
   La base le bloque désormais aussi en cas d'insertion directe.
3. **Fonction installée** : dans l'éditeur SQL de Lovable Cloud, en lecture seule :
   ```sql
   select position('Gabarit non accepté' in prosrc) > 0 as controle_chiens_actif
   from pg_proc where proname = 'prepare_booking_request';
   ```
   Le résultat attendu est `true`.

## Retour arrière

Si besoin, demandez à Lovable de remettre la version de
`drizzle/migrations/0004_booking_payments_insert_guard.sql`.
