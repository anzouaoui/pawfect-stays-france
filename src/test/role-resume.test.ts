import { describe, expect, it } from "vitest";
import { shouldResumeRoleChoice } from "@/lib/auth-redirect";

describe("reprise du choix de rôle", () => {
  it("renvoie vers l'écran de choix un utilisateur connecté sans rôle, où qu'il soit", () => {
    expect(shouldResumeRoleChoice("/", null)).toBe(true);
    expect(shouldResumeRoleChoice("/mes-demandes", null)).toBe(true);
    expect(shouldResumeRoleChoice("/mes-annonces", null)).toBe(true);
  });
  it("n'interrompt jamais les écrans de connexion et de réinitialisation", () => {
    expect(shouldResumeRoleChoice("/auth", null)).toBe(false);
    expect(shouldResumeRoleChoice("/reinitialisation", null)).toBe(false);
  });
  it("laisse naviguer librement un utilisateur dont le rôle est enregistré", () => {
    expect(shouldResumeRoleChoice("/", "voyageur")).toBe(false);
    expect(shouldResumeRoleChoice("/mes-annonces", "hote")).toBe(false);
  });
  it("ne redirige pas tant que le rôle n'est pas chargé", () => {
    expect(shouldResumeRoleChoice("/", undefined)).toBe(false);
  });
});
