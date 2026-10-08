CREATE TABLE public.host_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 120),
  type text NOT NULL,
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  region text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  price_per_night numeric(10,2) NOT NULL CHECK (price_per_night > 0),
  dog_fee_per_night numeric(10,2) NOT NULL DEFAULT 0 CHECK (dog_fee_per_night >= 0),
  cleaning_fee numeric(10,2) NOT NULL DEFAULT 0 CHECK (cleaning_fee >= 0),
  min_nights int NOT NULL DEFAULT 1 CHECK (min_nights BETWEEN 1 AND 60),
  available_from date NOT NULL,
  available_to date NOT NULL,
  blocked_dates date[] NOT NULL DEFAULT '{}',
  fenced_garden boolean NOT NULL DEFAULT false,
  sizes text[] NOT NULL DEFAULT '{}',
  max_dogs int NOT NULL DEFAULT 1 CHECK (max_dogs BETWEEN 1 AND 10),
  equipment text[] NOT NULL DEFAULT '{}',
  dog_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  photos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'publiée' CHECK (status IN ('brouillon','publiée')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_to >= available_from)
);

GRANT SELECT ON public.host_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.host_listings TO authenticated;
GRANT ALL ON public.host_listings TO service_role;

ALTER TABLE public.host_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published listings are public" ON public.host_listings
  FOR SELECT TO anon, authenticated USING (status = 'publiée');
CREATE POLICY "Owners read own listings" ON public.host_listings
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners create listings" ON public.host_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update listings" ON public.host_listings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners delete listings" ON public.host_listings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER host_listings_touch BEFORE UPDATE ON public.host_listings
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "Listing photos are public" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'listing-photos');
CREATE POLICY "Hosts upload own listing photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Hosts delete own listing photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'listing-photos' AND (storage.foldername(name))[1] = auth.uid()::text);