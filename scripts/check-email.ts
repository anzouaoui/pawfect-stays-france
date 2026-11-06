/**
 * Vérifie la configuration e-mail (n'envoie aucun message).
 *   bun run email:check          → variables présentes et bien formées
 *   bun run email:check --live   → + clé acceptée par Resend et domaine d'expédition vérifié
 *   bun run email:check --live --strict → contrôle de mise en prod : refuse aussi l'expéditeur @resend.dev
 * DMARC n'est pas contrôlé par Resend : voir docs/email-domain-setup.md.
 * Les variables sont lues depuis l'environnement (Bun charge aussi .env / .env.local).
 */
import { checkEmailConnection } from "../src/lib/booking-emails/email-config.server";

const live = process.argv.includes("--live");
const strict = process.argv.includes("--strict");
const report = await checkEmailConnection({ live, strict });

for (const v of report.missing) console.error(`✗ Variable manquante : ${v}`);
for (const e of report.errors) console.error(`✗ ${e}`);
for (const w of report.warnings) console.warn(`! ${w}`);
if (report.api) console.log(`${report.api.keyValid ? "✓" : "✗"} API Resend : ${report.api.detail}`);
console.log(report.ok ? "✓ Configuration e-mail prête" : "✗ Configuration e-mail incomplète");
process.exit(report.ok ? 0 : 1);
