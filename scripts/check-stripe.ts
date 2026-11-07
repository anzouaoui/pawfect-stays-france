/**
 * Contrôle de pré-lancement Stripe, en lecture seule (GET /v1/account) : ne modifie jamais le compte.
 *   bun run stripe:check
 * Prêt (code 0) seulement avec des clés live cohérentes ET un compte activé par Stripe
 * (details_submitted, charges_enabled, payouts_enabled, rien en retard).
 * Les variables sont lues depuis l'environnement (Bun charge aussi .env / .env.local).
 * Voir docs/stripe-live-checklist.md.
 */
import { checkStripeAccount } from "../src/lib/stripe-config.server";

const report = await checkStripeAccount();
if (report.mode) console.log(`Mode des clés : ${report.mode}`);
if (report.account) {
  const a = report.account;
  const mark = (v: boolean) => (v ? "✓" : "✗");
  console.log(`${mark(a.detailsSubmitted)} Dossier soumis  ${mark(a.chargesEnabled)} Paiements  ${mark(a.payoutsEnabled)} Virements`);
  console.log(`Pays : ${a.country ?? "?"} · Devise : ${a.defaultCurrency ?? "?"}`);
}
for (const e of report.errors) console.error(`✗ ${e}`);
for (const w of report.warnings) console.warn(`! ${w}`);
console.log(report.ready ? "✓ Compte prêt pour les paiements réels" : "✗ Paiements réels NON prêts");
process.exit(report.ready ? 0 : 1);
