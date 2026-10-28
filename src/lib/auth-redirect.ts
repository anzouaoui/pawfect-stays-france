export type AppRole = "voyageur" | "hote";

/** localStorage key holding the role chosen at signup until the e-mail link opens a new tab. */
export const SIGNUP_ROLE_KEY = "petinn-signup-role";

/** localStorage key holding the path to reach after sign-in (survives the e-mail-link tab). */
export const AUTH_REDIRECT_KEY = "petinn-auth-redirect";

export function safePath(v: unknown): string {
  if (typeof v !== "string" || !v.startsWith("/") || v.startsWith("//") || /[\\\x00-\x20]/.test(v)) return "";
  const url = new URL(v, "https://petinn.invalid");
  if (url.origin !== "https://petinn.invalid" || url.pathname === "/auth") return "";
  return url.pathname + url.search + url.hash;
}

/** Where an account lands when no explicit destination was requested. */
export function destinationForRole(role: string | null | undefined): string {
  return role === "hote" ? "/mes-annonces" : "/mes-demandes";
}

export function isAppRole(v: unknown): v is AppRole {
  return v === "voyageur" || v === "hote";
}

/** Screens a signed-in user without a role must be able to reach without being bounced to /auth. */
const ROLE_CHOICE_EXEMPT_PATHS = ["/auth", "/reinitialisation"];

/** True when a signed-in user who never finished the role choice must be sent back to it. */
export function shouldResumeRoleChoice(pathname: string, role: string | null | undefined): boolean {
  if (role !== null) return false;
  return !ROLE_CHOICE_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
