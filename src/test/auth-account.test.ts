import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectRole, upsert } = vi.hoisted(() => ({ selectRole: vi.fn(), upsert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: selectRole }) }), upsert }),
} }));
import { readAccountRole, saveFirstAccountRole } from "@/lib/auth-account";

describe("first account role", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("leaves a new Google account without a role until a choice is made", async () => {
    selectRole.mockResolvedValue({ data: null, error: null });
    expect(await readAccountRole("new-account")).toBeNull();
    expect(upsert).not.toHaveBeenCalled();
  });
  it.each(["voyageur", "hote"] as const)("persists the chosen %s role and reads it back", async (role) => {
    selectRole.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { role }, error: null });
    upsert.mockResolvedValue({ error: null });
    expect(await saveFirstAccountRole("new-account", role)).toBe(role);
    expect(upsert).toHaveBeenCalledWith({ user_id: "new-account", role }, { onConflict: "user_id", ignoreDuplicates: true });
    expect(selectRole).toHaveBeenCalledTimes(2);
  });
  it("does not replace an existing host role", async () => {
    selectRole.mockResolvedValue({ data: { role: "hote" }, error: null });
    expect(await saveFirstAccountRole("host", "voyageur")).toBe("hote");
    expect(upsert).not.toHaveBeenCalled();
  });
  it("honors a concurrent choice rather than assuming its own insert won", async () => {
    selectRole.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: { role: "hote" }, error: null });
    upsert.mockResolvedValue({ error: null });
    expect(await saveFirstAccountRole("new-account", "voyageur")).toBe("hote");
  });
  it("does not redirect with an unsaved role on persistence failure", async () => {
    selectRole.mockResolvedValue({ data: null, error: null });
    upsert.mockResolvedValue({ error: new Error("offline") });
    await expect(saveFirstAccountRole("new-account", "hote")).rejects.toThrow("offline");
  });
});