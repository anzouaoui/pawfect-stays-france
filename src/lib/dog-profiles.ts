import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/booking-requests";
import type { Dog } from "@/lib/store";

export const dogProfileSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(50),
  breed: z.string().trim().min(1, "Race requise").max(60),
  size: z.enum(["petit", "moyen", "grand"]),
  weight: z.number().positive("Poids requis").lt(120),
  behavior: z.string().max(500),
});
export type DogProfileInput = z.infer<typeof dogProfileSchema>;

export async function loadDogProfiles(ownerId: string): Promise<Dog[]> {
  const { data, error } = await supabase.from("dog_profiles")
    .select("id, name, breed, size, weight, behavior").eq("owner_id", ownerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...dogProfileSchema.parse({ ...row, weight: Number(row.weight) }), id: row.id }));
}

export async function saveDogProfiles(ownerId: string, inputs: DogProfileInput[]) {
  const profiles = inputs.map((input) => ({ ...dogProfileSchema.parse(input), owner_id: ownerId }));
  const { error } = await supabase.from("dog_profiles").insert(profiles);
  if (error) throw error;
}

export async function deleteDogProfile(ownerId: string, id: string) {
  const { error, data } = await supabase.from("dog_profiles").delete()
    .eq("owner_id", ownerId).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Ce passeport n’est plus disponible.");
}

export function useDogs() {
  const user = useSessionUser();
  const queryClient = useQueryClient();
  const queryKey = ["dog-profiles", user?.id];
  const query = useQuery({
    queryKey,
    queryFn: () => {
      if (!user) throw new Error("Connectez-vous pour retrouver vos chiens.");
      return loadDogProfiles(user.id);
    },
    enabled: !!user,
  });
  const mutation = useMutation({
    mutationFn: async (action: { inputs: DogProfileInput[] } | { id: string }) => {
      if (!user) throw new Error("Connectez-vous pour enregistrer vos chiens.");
      if ("inputs" in action) await saveDogProfiles(user.id, action.inputs);
      else await deleteDogProfile(user.id, action.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  return {
    user, dogs: user ? query.data ?? [] : [],
    loading: user === undefined || (!!user && query.isPending),
    error: user ? query.error : null,
    busy: mutation.isPending,
    addDogs: (inputs: DogProfileInput[]) => mutation.mutateAsync({ inputs }),
    removeDog: (id: string) => mutation.mutateAsync({ id }),
    retry: () => query.refetch(),
  };
}