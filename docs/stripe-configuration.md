# Configuration de Stripe

PetInn n'encaisse pas directement : à la demande de réservation, il pose une **empreinte bancaire**
(PaymentIntent en `capture_method: manual`, devise `eur`).

- Si l'hôte accepte, le montant est **capturé** (débité).
- Si l'hôte refuse, si le voyageur annule ou si la demande expire au bout de 24 h, l'empreinte est **annulée** (libérée).

Code concerné : [payments.functions.ts](../src/lib/payments.functions.ts),
[stripe-config.server.ts](../src/lib/stripe-config.server.ts),
[CardHoldForm.tsx](../src/components/CardHoldForm.tsx) et le cron
[expire-requests.ts](../src/routes/api/public/cron/expire-requests.ts).

## 1. Les deux variables à renseigner

À créer dans **Lovable Cloud → Secrets**. C'est le même coffre que les secrets Supabase du projet.
**Jamais dans `.env`**, qui est versionné.

| Variable | Valeur | Où la trouver |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` (test) ou `sk_live_…` (production). Une clé restreinte `rk_…` est aussi acceptée. | Stripe Dashboard → **Développeurs → Clés API** → « Clé secrète » |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (test) ou `pk_live_…` (production) | Même page → « Clé publiable » |

`VITE_STRIPE_PUBLISHABLE_KEY` est encore lue en secours, mais préférez `STRIPE_PUBLISHABLE_KEY`.
Elle est lue côté serveur à chaque requête, donc il n'y a pas besoin de rebuild quand elle change.

### Contrôles automatiques

Le serveur vérifie les clés avant toute opération de paiement :

| Problème | Conséquence |
| --- | --- |
| Clé secrète ou publique absente | Le paiement est indisponible. Aucune demande n'est créée et la carte n'est pas sollicitée. |
| Clé publique qui commence par `sk_` ou `rk_` (clé **secrète** collée au mauvais endroit) | La clé n'est **jamais** envoyée au navigateur. Le paiement est indisponible. **Régénérez cette clé secrète dans Stripe** (« Roll key »), car elle a pu être exposée ailleurs. |
| Préfixe inconnu | Le paiement est indisponible. |
| Modes incohérents (`sk_live` avec `pk_test`, ou l'inverse) | Le paiement est indisponible. Sinon, Stripe.js refuserait le `client_secret` créé par le serveur. |
| Stripe refuse la clé secrète (HTTP 401 : clé révoquée) | Le paiement est indisponible. |

Côté interface, le voyageur voit un message clair (« Le service de paiement est momentanément
indisponible… Votre carte n'a pas été débitée ») avec un bouton **Réessayer**. La page ne reste
plus bloquée sur « Chargement du paiement… ».

Le détail technique n'apparaît que dans les logs serveur, sans jamais la valeur des clés :

```
[stripe] configuration invalide (mode_mismatch) : Clés Stripe incohérentes : clé secrète en mode live, clé publique en mode test.
```

## 2. Paramétrage recommandé du compte Stripe

### Compte et devise
- **Pays du compte : France.** Cela active les Cartes Bancaires (CB) et le bon cadre SCA/3-D Secure.
- **Devise de règlement : EUR**, avec un **IBAN français ou de la zone SEPA** (Paramètres → **Comptes bancaires et devises**). Le code crée toujours les paiements en `eur` : aucune conversion n'a lieu.
- **Libellé sur le relevé bancaire** : Paramètres → **Données publiques de l'entreprise** → `PETINN`, pour que le voyageur reconnaisse l'empreinte.
- **Activation du mode live** : complétez le profil de l'entreprise (identité, SIRET, IBAN). Sans cela, les clés `sk_live`/`pk_live` ne peuvent pas encaisser.

### Moyens de paiement
Paramètres → **Moyens de paiement** (configuration par défaut) :
- **Cartes : activé.** Cela couvre Visa, Mastercard et **Cartes Bancaires (CB)**. Sur un compte français, les cartes co-badgées CB/Visa ou CB/Mastercard sont reconnues automatiquement, et le client peut choisir le réseau.
- **Apple Pay / Google Pay** : facultatifs. Ils fonctionnent avec l'empreinte, mais Apple Pay demande de vérifier le domaine (Paramètres → Moyens de paiement → Apple Pay → domaines).
- **Les autres méthodes** (virement, prélèvement SEPA, Bancontact, iDEAL…) **ne s'afficheront pas**. Le code demande `allow_redirects: never` et une capture manuelle, ce que seules les cartes et les portefeuilles supportent. Vous pouvez les laisser désactivées.

### Points d'attention
- **Durée de validité d'une empreinte : 7 jours** pour un paiement carte en ligne. Au-delà, Stripe l'annule. Le cron expire les demandes au bout de 24 h, donc on reste largement dans la limite.
- **3-D Secure** est géré par le formulaire Stripe (`confirmPayment`, `redirect: "if_required"`). Rien à configurer.
- **Reçus e-mail Stripe** : facultatifs (Paramètres → **E-mails clients**). PetInn envoie déjà ses propres notifications.

## 3. Passer du test au live

Checklist complète (KYC, preuves à conserver, contrôle `bun run stripe:check`, recette) :
[stripe-live-checklist.md](stripe-live-checklist.md).

1. Testez d'abord avec `sk_test_…` et `pk_test_…`, par exemple avec la carte `4242 4242 4242 4242`, n'importe quelle date future et n'importe quel CVC. La carte `4000 0025 0000 3155` déclenche 3-D Secure.
2. Une fois le compte activé, remplacez **les deux** clés **en même temps** par `sk_live_…` et `pk_live_…`. Si vous n'en changez qu'une, le contrôle de cohérence bloque le paiement, ce qui est volontaire.
3. Faites une vraie réservation de faible montant, vérifiez l'empreinte dans Stripe (**Paiements → « Non capturé »**), puis refusez-la depuis l'Espace hôte pour la libérer.
