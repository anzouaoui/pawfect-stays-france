import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadDogProfiles, saveDogProfiles, deleteDogProfile } from "@/lib/dog-profiles";

const db = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), insert: vi.fn(), delete: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
const dog = { name: "Nala", breed: "Labrador", size: "grand" as const, weight: 28, behavior: "Sociable" };

beforeEach(() => {
  vi.resetAllMocks();
  db.from.mockReturnValue(db);
  db.select.mockReturnValue(db);
  db.eq.mockReturnValue(db);
  db.delete.mockReturnValue(db);
});

describe("Account-owned canine passports", () => {
  it("saves all dog information attached to the traveler account", async () => {
    db.insert.mockResolvedValue({ error: null });
    await saveDogProfiles("traveler-a", [dog]);
    expect(db.from).toHaveBeenCalledWith("dog_profiles");
    expect(db.insert).toHaveBeenCalledWith([{ ...dog, owner_id: "traveler-a" }]);
  });
  it("loads only the current traveler's dogs", async () => {
    db.order.mockResolvedValue({ data: [{ ...dog, id: "dog-a", weight: "28" }], error: null });
    expect(await loadDogProfiles("traveler-a")).toEqual([{ ...dog, id: "dog-a" }]);
    expect(db.eq).toHaveBeenCalledWith("owner_id", "traveler-a");
  });
  it("scopes deletion to the traveler's account and dog", async () => {
    db.select.mockResolvedValue({ data: [{ id: "dog-a" }], error: null });
    await deleteDogProfile("traveler-a", "dog-a");
    expect(db.eq.mock.calls).toEqual([["owner_id", "traveler-a"], ["id", "dog-a"]]);
  });
});