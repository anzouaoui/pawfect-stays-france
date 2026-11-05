/**
 * Amorçage des annonces réelles dans Lovable Cloud (table host_listings + bucket listing-photos).
 * Procédure complète : docs/seeding-listings.md
 *
 *   bun run listings:seed --owner hote@exemple.fr               # simulation (aucune écriture)
 *   bun run listings:seed --owner hote@exemple.fr --apply       # insertion réelle
 *   bun run listings:seed --check                               # vérifie ce que voit le public
 *
 * Options : --file <chemin> (défaut scripts/seed-listings.json), --owner <e-mail ou id du compte hôte>.
 * Variables : SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (déjà dans .env) et, pour --owner/--apply,
 * SUPABASE_SERVICE_ROLE_KEY (à mettre dans .env.local, jamais dans .env).
 */
import { readFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MAX_PHOTO_BYTES, PHOTO_EXTENSIONS, extensionOf, toListingRow, validateSeedFile, type SeedEntry } from "../src/lib/listing-seed";

const BUCKET = "listing-photos";
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

const ok = (m: string) => console.log(`✓ ${m}`);
const warn = (m: string) => console.warn(`! ${m}`);
const fail = (m: string): never => { console.error(`✗ ${m}`); process.exit(1); };

function env(name: string) {
  const v = process.env[name]?.trim();
  return v || undefined;
}

async function main() {
  if (flag("check")) return check();

  const file = path.resolve(option("file") ?? "scripts/seed-listings.json");
  const json = JSON.parse(await readFile(file, "utf8").catch(() => fail(`Fichier introuvable : ${file} (copiez scripts/seed-listings.example.json)`)));
  const report = validateSeedFile(json, today);
  report.warnings.forEach(warn);
  report.errors.forEach((e) => console.error(`✗ ${e}`));
  if (report.errors.length) fail(`${report.errors.length} erreur(s) dans ${path.basename(file)} : rien n'a été envoyé.`);
  ok(`${report.entries.length} annonce(s) valides dans ${path.basename(file)}`);

  const baseDir = path.dirname(file);
  const photos = new Map<SeedEntry, string[]>();
  for (const e of report.entries) {
    const resolved = e.photos.map((p) => path.resolve(baseDir, p));
    for (const p of resolved) {
      const s = await stat(p).catch(() => fail(`« ${e.name} » : photo introuvable ${p}`));
      if (s.size > MAX_PHOTO_BYTES) fail(`« ${e.name} » : ${path.basename(p)} dépasse 8 Mo`);
    }
    photos.set(e, resolved);
  }
  ok("Toutes les photos sont présentes et font moins de 8 Mo");

  const ownerArg = option("owner");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!ownerArg || !serviceKey) {
    if (flag("apply")) fail("--apply exige --owner et SUPABASE_SERVICE_ROLE_KEY.");
    warn("Sans --owner et SUPABASE_SERVICE_ROLE_KEY, seul le fichier a été vérifié.");
    return;
  }
  const url = env("SUPABASE_URL") ?? fail("SUPABASE_URL manquant.");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const owner = await resolveOwner(admin, ownerArg);
  ok(`Compte hôte : ${owner.email ?? owner.id} (${owner.id})`);

  const { data: existing, error: existingError } = await admin.from("host_listings").select("name").eq("owner_id", owner.id);
  if (existingError) fail(`Lecture des annonces existantes impossible : ${existingError.message}`);
  const taken = new Set((existing ?? []).map((r) => (r.name as string).trim().toLowerCase()));
  const todo = report.entries.filter((e) => {
    if (taken.has(e.name.trim().toLowerCase())) { warn(`« ${e.name} » existe déjà pour ce compte : ignorée.`); return false; }
    return true;
  });

  if (!flag("apply")) {
    todo.forEach((e) => ok(`À créer : « ${e.name} » (${e.type}, ${e.city}) — ${photos.get(e)!.length} photo(s), ${e.price_per_night} €/nuit`));
    console.log(`\nSimulation terminée : ${todo.length} annonce(s) seraient publiées. Relancez avec --apply pour les créer.`);
    return;
  }

  let created = 0;
  for (const e of todo) {
    const uploaded: string[] = [];
    try {
      for (const local of photos.get(e)!) {
        const ext = extensionOf(local) as keyof typeof PHOTO_EXTENSIONS;
        const remote = `${owner.id}/${randomUUID()}.${ext}`;
        const { error } = await admin.storage.from(BUCKET).upload(remote, await readFile(local), { contentType: PHOTO_EXTENSIONS[ext] });
        if (error) throw new Error(`envoi de ${path.basename(local)} : ${error.message}`);
        uploaded.push(remote);
      }
      const { data, error } = await admin.from("host_listings").insert(toListingRow(e, owner.id, uploaded)).select("id").single();
      if (error) throw new Error(`insertion : ${error.message}`);
      created++;
      ok(`Publiée : « ${e.name} » → /hebergement/${data.id}`);
    } catch (err) {
      if (uploaded.length) await admin.storage.from(BUCKET).remove(uploaded);
      console.error(`✗ « ${e.name} » non créée (${(err as Error).message}) ; photos envoyées supprimées.`);
    }
  }
  console.log(`\n${created}/${todo.length} annonce(s) créée(s).`);
  await check();
  if (created < todo.length) process.exit(1);
}

async function resolveOwner(admin: SupabaseClient, value: string) {
  let user: { id: string; email?: string | undefined } | undefined;
  if (/^[0-9a-f-]{36}$/i.test(value)) {
    const { data, error } = await admin.auth.admin.getUserById(value);
    if (error) fail(`Compte ${value} introuvable : ${error.message}`);
    user = data.user ?? undefined;
  } else {
    for (let page = 1; !user; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) fail(`Liste des comptes impossible : ${error.message}`);
      user = data.users.find((u) => u.email?.toLowerCase() === value.toLowerCase());
      if (data.users.length < 1000) break;
    }
  }
  if (!user) return fail(`Aucun compte pour ${value} : l'hôte doit d'abord s'inscrire sur le site.`);
  const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "hote") fail(`Le compte ${value} n'a pas le rôle Hôte (rôle actuel : ${role?.role ?? "aucun"}).`);
  return user;
}

/** Read-only: what an anonymous visitor gets from the search. */
async function check() {
  const url = env("SUPABASE_URL") ?? fail("SUPABASE_URL manquant.");
  const key = env("SUPABASE_PUBLISHABLE_KEY") ?? fail("SUPABASE_PUBLISHABLE_KEY manquant.");
  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await anon.from("host_listings").select("id, name, type, city, photos, sizes, available_to, price_per_night").eq("status", "publiée");
  if (error) fail(`Lecture publique impossible : ${error.message}`);
  const rows = data ?? [];
  console.log(`\nVérification publique : ${rows.length} annonce(s) publiée(s)`);
  let problems = 0;
  for (const r of rows) {
    const issues: string[] = [];
    if (!r.photos.length) issues.push("aucune photo");
    else {
      const { data: signed } = await anon.storage.from(BUCKET).createSignedUrls(r.photos, 60);
      const okUrls = (signed ?? []).filter((s) => s.signedUrl).length;
      if (okUrls < r.photos.length) issues.push(`${r.photos.length - okUrls} photo(s) illisible(s)`);
    }
    if (!r.sizes.length) issues.push("aucun gabarit");
    if (r.available_to < today) issues.push("disponibilités expirées");
    problems += issues.length ? 1 : 0;
    (issues.length ? warn : ok)(`${r.name} — ${r.type}, ${r.city}, ${r.price_per_night} €/nuit${issues.length ? ` : ${issues.join(", ")}` : ""}`);
  }
  if (!rows.length) fail("Aucune annonce publiée : la recherche est vide pour les visiteurs.");
  if (problems) process.exit(1);
}

await main();
