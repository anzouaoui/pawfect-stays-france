REVOKE ALL ON public.dog_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dog_profiles TO authenticated;
GRANT ALL ON public.dog_profiles TO service_role;