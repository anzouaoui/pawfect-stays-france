# Activer le cron d'expiration des demandes

La route `POST /api/public/cron/expire-requests`
([expire-requests.ts](../src/routes/api/public/cron/expire-requests.ts)) :

1. sélectionne au plus **100** demandes `booking_requests` au statut `en attente` créées il y a plus de **24 h** ;
2. annule l'empreinte bancaire Stripe (`POST /v1/payment_intents/{id}/cancel`) quand `payment_intent_id` est renseigné ;
3. passe la demande à `status = 'expirée'` et `payment_status = 'libéré'` (mise à jour conditionnée à `status = 'en attente'` pour ne pas écraser une acceptation de l'hôte survenue entre-temps) ;
4. envoie l'e-mail `traveler-expired` si l'empreinte était `autorisé`.

**Si Stripe refuse l'annulation** (erreur HTTP, panne réseau, clé absente), la demande reste `en attente` et sera retentée au passage suivant : elle n'est jamais marquée `libéré` tant que l'empreinte bloque la carte. Un PaymentIntent que Stripe signale déjà `canceled` est considéré comme libéré.

Réponse :

```json
{ "expired": 3, "failed": 1, "failures": [{ "id": "<uuid>", "reason": "stripe_400_payment_intent_unexpected_state" }] }
```

Un `failed` qui reste non nul d'un passage à l'autre demande une intervention (ex. PaymentIntent déjà capturé : vérifier la demande dans Stripe). Rien n'appelle la route tant qu'aucune planification n'est configurée.

## 1. Secrets requis (Lovable Cloud → Secrets)

| Secret | Rôle |
| --- | --- |
| `LOVABLE_CRON_SECRET` | Jeton attendu dans `Authorization: Bearer <secret>`. Sans lui, la route répond **500**. |
| `LOVABLE_CRON_SECRET_PREVIOUS` | Facultatif : ancien jeton, accepté pendant une rotation. |
| `STRIPE_SECRET_KEY` | Clé utilisée pour annuler l'empreinte. |
| `SITE_URL` | Facultatif : domaine public utilisé dans les liens des e-mails. |

Générer un secret robuste, par exemple :

```bash
openssl rand -hex 32
```

Réponses de la route : `401` (en-tête absent, mal formé ou secret invalide), `500` (secret non configuré ou lecture de la base impossible), `200` (exécution, avec le détail des échecs éventuels).

## 2. Option A — pg_cron + pg_net (Supabase)

Dans l'éditeur SQL du projet Supabase/Lovable Cloud :

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Stocker l'URL et le secret dans Vault plutôt qu'en clair dans la tâche
select vault.create_secret('https://<votre-domaine>', 'site_url');
select vault.create_secret('<valeur de LOVABLE_CRON_SECRET>', 'lovable_cron_secret');

select cron.schedule(
  'expire-booking-requests',
  '*/15 * * * *',            -- toutes les 15 minutes
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'site_url')
               || '/api/public/cron/expire-requests',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'lovable_cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

Contrôler :

```sql
select jobid, jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select status_code, content from net._http_response order by created desc limit 10;
```

Désactiver ou supprimer : `select cron.unschedule('expire-booking-requests');`

## 3. Option B — webhook HTTP récurrent

Tout planificateur capable d'envoyer un POST avec en-tête (GitHub Actions `schedule`, cron-job.org, EasyCron, Cloudflare Cron Trigger…) :

```bash
curl -fsS -X POST "https://<votre-domaine>/api/public/cron/expire-requests" -H "Authorization: Bearer $LOVABLE_CRON_SECRET"
```

Garder le secret dans le coffre du planificateur (jamais dans l'URL ni dans le dépôt).

## 4. Fréquence et rotation

- Chaque passage traite au plus 100 demandes : toutes les 15 minutes suffit largement et borne le retard d'expiration à ~15 min au-delà des 24 h.
- Rotation sans coupure : copier l'ancien secret dans `LOVABLE_CRON_SECRET_PREVIOUS`, définir le nouveau dans `LOVABLE_CRON_SECRET`, mettre à jour la planification (Vault ou planificateur), puis vider `LOVABLE_CRON_SECRET_PREVIOUS`.

## 5. Vérifier après activation

1. Appel sans en-tête → `401`.
2. Appel avec le secret → `200 {"expired": n, "failed": 0, ...}`.
3. Dans Stripe (Dashboard → Payments), les PaymentIntents concernés passent à `canceled`.
4. Tests automatisés : `npm test` (fichier [cron-expire.test.ts](../src/test/cron-expire.test.ts)).
