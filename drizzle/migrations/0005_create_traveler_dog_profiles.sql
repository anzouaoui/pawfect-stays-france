CREATE TABLE public.dog_profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 50),
 breed text NOT NULL CHECK (char_length(btrim(breed)) BETWEEN 1 AND 60),
 size text NOT NULL CHECK (size IN ('petit', 'moyen', 'grand')),
 weight numeric NOT NULL CHECK (weight > 0 AND weight < 120),
 behavior text NOT NULL DEFAULT '' CHECK (char_length(behavior) <= 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_profiles TO authenticated;
GRANT ALL ON public.dog_profiles TO service_role;
ALTER TABLE public.dog_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Travelers read own dog profiles" ON public.dog_profiles FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Travelers create own dog profiles" ON public.dog_profiles FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Travelers update own dog profiles" ON public.dog_profiles FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Travelers delete own dog profiles" ON public.dog_profiles FOR DELETE TO authenticated USING (owner_id = auth.uid());
CREATE INDEX dog_profiles_owner_idx ON public.dog_profiles(owner_id);