import { supabase } from "@/integrations/supabase/client";
import { isAppRole, type AppRole } from "./auth-redirect";

export async function readAccountRole(userId: string): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return isAppRole(data?.role) ? data.role : null;
}

/** Insert once, then read the authoritative value (including concurrent-tab choices). */
export async function saveFirstAccountRole(userId: string, role: AppRole): Promise<AppRole> {
  const existing = await readAccountRole(userId);
  if (existing) return existing;
  const { error } = await supabase.from("user_roles").upsert(
    { user_id: userId, role },
    { onConflict: "user_id", ignoreDuplicates: true },
  );
  if (error) throw error;
  const saved = await readAccountRole(userId);
  if (!saved) throw new Error("Le type de compte n’a pas été enregistré.");
  return saved;
}