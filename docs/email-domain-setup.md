# Domaine d'envoi des e-mails (Resend) — checklist DNS

> **Statut (6 novembre 2026) : 🟡 action DNS en attente.** Aucun domaine n'est encore
> acheté ni vérifié dans Resend. Le code reste paramétré par `EMAIL_FROM` ; tant qu'aucun
> domaine vérifié n'est configuré, les e-mails de réservation ne sont pas livrés aux
> voyageurs ni aux hôtes (`not_configured`, ou livraison limitée au propriétaire du compte
> avec `onboarding@resend.dev`). **Bloquant pour la mise en production.**

## Ce que le code attend

| Secret (Lovable Cloud → Secrets) | Valeur |
| --- | --- |
| `RESEND_API_KEY` | Clé Resend `re_…` (« Sending access » suffit pour l'envoi, « Full access » pour `email:check --live`). |
| `EMAIL_FROM` | `PetInn <notifications@<votre-domaine>>` — **adresse du domaine vérifié exact** (un sous-domaine vérifié séparément compte comme un autre domaine). |
| `EMAIL_REPLY_TO` | Facultatif : boîte réellement lue (peut être une adresse personnelle). |
| `SITE_URL` | `https://<votre-domaine>` une fois le site branché dessus. |

Garde-fous du code (`src/lib/booking-emails/email-config.server.ts`) :

- `@resend.dev` → avertissement (erreur avec `--strict`) : Resend ne livre qu'au propriétaire du compte.
- Domaines de messagerie publique (`gmail.com`, `outlook.fr`, `orange.fr`…) et `lovable.app` → **erreur** :
  ils ne peuvent pas être vérifiés dans Resend, l'envoi serait refusé.

## 1. Ajouter le domaine dans Resend

1. Acheter le domaine (ex. chez OVHcloud, Gandi, Cloudflare…).
2. Resend → **Domains → Add domain** → saisir le domaine.
   Choisir la région **EU (eu-west-1)** pour rester cohérent avec les mentions légales (sous-traitant e-mail).
3. Resend affiche les enregistrements à créer. **Copier les valeurs exactes depuis Resend** :
   le tableau ci-dessous montre leur forme, pas les valeurs (la clé DKIM est propre au compte).

## 2. Enregistrements DNS à poser

| Rôle | Type | Nom (hôte) | Valeur | Priorité |
| --- | --- | --- | --- | --- |
| SPF (retour / bounce) | `MX` | `send` | `feedback-smtp.<région>.amazonses.com` (copier depuis Resend) | `10` |
| SPF | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` (copier depuis Resend) | — |
| DKIM | `TXT` | `resend._domainkey` | `p=MIGf…` (clé publique fournie par Resend) | — |
| DMARC | `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<adresse-de-rapport>` | — |

Remarques :

- Les enregistrements SPF portent sur le sous-domaine `send` : ils ne modifient pas un éventuel SPF
  existant à la racine (boîte mail du domaine). Si un registrar ajoute automatiquement le domaine au nom
  (`send.<domaine>.<domaine>`), saisir seulement `send`.
- **DMARC n'est pas vérifié par Resend** : il faut le contrôler soi-même (étape 4). Commencer en `p=none`,
  lire les rapports 2 à 4 semaines, puis passer à `p=quarantine` (et éventuellement `p=reject`).
  Gmail et Yahoo exigent un DMARC publié pour les expéditeurs en volume.
- Propagation : de quelques minutes à 48 h.

## 3. Configurer l'application

1. Lovable Cloud → Secrets : `EMAIL_FROM=PetInn <notifications@<votre-domaine>>` (et `SITE_URL`).
2. Ne rien mettre de secret dans `.env` (fichier versionné).

## 4. Vérifications à effectuer (aucune n'est faite à ce jour)

- [ ] Resend → Domains : statut **Verified** (SPF et DKIM au vert).
- [ ] `bun run email:check --live --strict` avec une clé « Full access » : sortie `✓ Configuration e-mail prête`.
      En cas d'échec, le script liste les enregistrements encore `pending` / `failed`.
- [ ] DNS publié, depuis un poste :
      ```bash
      nslookup -type=TXT _dmarc.<votre-domaine>
      nslookup -type=TXT resend._domainkey.<votre-domaine>
      nslookup -type=TXT send.<votre-domaine>
      nslookup -type=MX send.<votre-domaine>
      ```
- [ ] Recette réelle : une demande de réservation sur une annonce hôte → l'hôte reçoit « nouvelle demande »
      dans une boîte **qui n'est pas** celle du compte Resend ; acceptation/refus → le voyageur reçoit le mail.
- [ ] Dans le message reçu (Gmail → « Afficher l'original ») : `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.
- [ ] Logs serveur : `[email] … envoyé à … (id Resend …)`, sans `configuration incomplète`.

Tant que ces cases ne sont pas cochées avec une preuve réelle, le point reste **NO-GO** pour la production.
