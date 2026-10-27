export type AppRole = "voyageur" | "hote";

/** localStorage key holding the role chosen at signup until the e-mail link opens a new tab. */
export const SIGNUP_ROLE_KEY = "petinn-signup-role";

/** localStorage key holding the path to reach after sign-in (survives the e-mail-link tab). */
export const AUTH_REDIRECT_KEY = "petinn-auth-redirect";

export function safePath(v: unknown): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "";
}

/** Where an account lands when no explicit destination was requested. */
export function destinationForRole(role: string | null | undefined): string {
  return role === "hote" ? "/mes-annonces" : "/mes-demandes";
}

export function isAppRole(v: unknown): v is AppRole {
  return v === "voyageur" || v === "hote";
}
