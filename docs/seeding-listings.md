# Amorcer les premières annonces

La recherche n'affiche que les annonces de la table `host_listings` au statut `publiée`.
Les logements d'exemple ont été retirés pour le lancement (`LISTINGS = []` dans `src/lib/data.ts`).
Tant qu'aucun hôte n'a publié, un visiteur ne trouve donc aucun hébergement.

Deux façons d'ajouter des annonces **réelles** :

| Méthode | Quand l'utiliser |
| --- | --- |
| **Dans l'app** : Mes annonces → Ajouter un logement | Une annonce à la fois, par l'hôte lui-même. Aucun accès technique requis. |
| **Script d'amorçage** `scripts/seed-listings.ts` | Plusieurs annonces préparées d'avance (hôtes partenaires du lancement), envoyées en une fois. |

> ⚠️ Toute annonce publiée est visible par tous et **réservable avec empreinte bancaire**.
> N'insérez que de vrais logements, avec l'accord de l'hôte et de vraies photos.
> Le script refuse les entrées du modèle (`"example": true`).

## 1. Prérequis

- L'hôte a **un compte sur le site** et a choisi le rôle **Hôte** (le script le vérifie dans `user_roles`).
- Vous avez la **clé de service** du projet Lovable Cloud (`SUPABASE_SERVICE_ROLE_KEY`). Elle donne un accès total à la base :
  mettez-la **uniquement** dans `.env.local` (ignoré par git), jamais dans `.env`, qui est versionné.
  ```bash
  echo SUPABASE_SERVICE_ROLE_KEY=... >> .env.local
  ```
  `SUPABASE_URL` et `SUPABASE_PUBLISHABLE_KEY` sont déjà dans `.env`.
- Bun installé (`bun --version`).

## 2. Préparer le fichier

```bash
cp scripts/seed-listings.example.json scripts/seed-listings.json
mkdir scripts/seed-photos
```

`scripts/seed-listings.json` et `scripts/seed-photos/` sont **ignorés par git** : les données des hôtes et leurs photos ne sont pas versionnées.

Pour chaque logement, remplacez les valeurs du modèle et **supprimez `"example": true`** :

| Champ | Règle |
| --- | --- |
| `name`, `city`, `region`, `description` | 3 à 120 caractères, 2 à 80, ≤ 80, 20 à 2000. Le nom doit être unique pour l'hôte. |
| `type` | `Hôtel`, `Camping`, `Villa`, `Village vacances` ou `Gîte` (filtre « type » de la recherche). |
| `price_per_night`, `dog_fee_per_night`, `cleaning_fee` | En euros. Prix > 0 ; frais ≥ 0. |
| `min_nights` | 1 à 60. |
| `available_from`, `available_to`, `blocked_dates` | `AAAA-MM-JJ`. Les dates bloquées doivent être dans la période, et la fin ne doit pas être passée. |
| `fenced_garden` | `true` seulement si le jardin est **entièrement clos** (filtre « Jardin clôturé »). |
| `sizes` | Parmi `petit`, `moyen`, `grand` (filtre « Gabarit »). |
| `max_dogs` | 1 à 10. |
| `equipment` | Parmi `Gamelles`, `Panier`, `Serviettes`, `Sacs à déjections`, `Douche pour chien`, `Plage à proximité`. |
| `dog_rules` | Au moins une règle `{ "title", "description" }` (10 caractères min.). |
| `photos` | 1 à 10 **vraies photos du logement**, en `.jpg`, `.jpeg`, `.png` ou `.webp`, de 8 Mo maximum, chemins relatifs au fichier JSON (ex. `seed-photos/gite-1.jpg`). La première est la photo de couverture. |

## 3. Simuler, puis publier

```bash
bun run listings:seed --owner hote@exemple.fr
```

La **simulation**, sans aucune écriture :
- valide chaque annonce ;
- vérifie la présence et la taille des photos ;
- vérifie le compte et son rôle Hôte ;
- signale les annonces déjà présentes, ignorées pour pouvoir relancer sans doublon ;
- liste ce qui serait créé.

```bash
bun run listings:seed --owner hote@exemple.fr --apply
```

Pour chaque annonce, le script :
1. envoie les photos dans le bucket `listing-photos` sous `<id de l'hôte>/<uuid>.<ext>`, comme l'assistant de publication ;
2. insère la ligne `host_listings` au statut `publiée` ;
3. en cas d'échec, supprime les photos déjà envoyées.

À la fin, il lance la vérification publique.

Options : `--file <chemin>` pour un autre fichier ; `--owner` accepte aussi l'identifiant (UUID) du compte.

## 4. Vérifier ce que voit le public

```bash
bun run listings:seed --check
```

Lecture seule avec la clé publique, comme un visiteur anonyme. La commande liste les annonces publiées et signale :
- une photo illisible ;
- un gabarit manquant ;
- des disponibilités expirées.

Elle sort en erreur s'il n'y a **aucune** annonce publiée : la recherche serait vide.

Puis ouvrez `/recherche` et testez les filtres type, gabarit et jardin clôturé.

## 5. Retirer une annonce

L'hôte la supprime ou la repasse en brouillon depuis **Mes annonces**. La suppression retire aussi ses photos.

## Tests automatisés

`src/test/listings-search.test.ts` part des 3 annonces du modèle et vérifie toute la chaîne :
1. validation du fichier, avec refus des exemples, des champs invalides, des dates passées et des doublons ;
2. ligne `host_listings` produite ;
3. chargement public (`getPublishedListings`) : seules les annonces publiées, photos signées, règles canines, disponibilités ;
4. filtres de recherche : type, gabarit, jardin clos, équipements, ville sans accents, prix, dates bloquées.
