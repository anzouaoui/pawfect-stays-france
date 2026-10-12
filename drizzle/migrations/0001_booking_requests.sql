CREATE TABLE public.booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.host_listings(id) ON DELETE CASCADE,
  traveler_id uuid NOT NULL DEFAULT auth.uid(),
  host_id uuid NOT NULL,
  listing_name text NOT NULL DEFAULT '',
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights int NOT NULL DEFAULT 0,
  dogs jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text NOT NULL DEFAULT '' CHECK (char_length(message) <= 500),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  fee numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en attente' CHECK (status IN ('en attente','acceptée','refusée')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE INDEX booking_requests_host_idx ON public.booking_requests(host_id);
CREATE INDEX booking_requests_traveler_idx ON public.booking_requests(traveler_id);

GRANT SELECT, INSERT ON public.booking_requests TO authenticated;
GRANT UPDATE (status) ON public.booking_requests TO authenticated;
GRANT ALL ON public.booking_requests TO service_role;

ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travelers read own requests" ON public.booking_requests
  FOR SELECT TO authenticated USING (auth.uid() = traveler_id);
CREATE POLICY "Hosts read requests for their listings" ON public.booking_requests
  FOR SELECT TO authenticated USING (auth.uid() = host_id);
CREATE POLICY "Travelers create requests" ON public.booking_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = traveler_id);
CREATE POLICY "Hosts decide on requests" ON public.booking_requests
  FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- Server-side pricing and host assignment so travelers cannot tamper with amounts.
CREATE OR REPLACE FUNCTION public.prepare_booking_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.host_listings; n int; dog_count int;
BEGIN
  SELECT * INTO l FROM public.host_listings WHERE id = NEW.listing_id AND status = 'publiée';
  IF NOT FOUND THEN RAISE EXCEPTION 'Logement indisponible'; END IF;
  IF l.owner_id = NEW.traveler_id THEN RAISE EXCEPTION 'Vous ne pouvez pas réserver votre propre logement'; END IF;
  n := NEW.check_out - NEW.check_in;
  dog_count := jsonb_array_length(NEW.dogs);
  IF n < l.min_nights THEN RAISE EXCEPTION 'Séjour trop court'; END IF;
  IF NEW.check_in < l.available_from OR NEW.check_out > l.available_to
     OR EXISTS (SELECT 1 FROM unnest(l.blocked_dates) d WHERE d >= NEW.check_in AND d < NEW.check_out) THEN
    RAISE EXCEPTION 'Dates indisponibles';
  END IF;
  IF dog_count < 1 OR dog_count > l.max_dogs THEN RAISE EXCEPTION 'Nombre de chiens non accepté'; END IF;
  NEW.host_id := l.owner_id;
  NEW.listing_name := l.name;
  NEW.nights := n;
  NEW.subtotal := n * l.price_per_night + n * l.dog_fee_per_night * dog_count + l.cleaning_fee;
  NEW.fee := round(NEW.subtotal * 0.1);
  NEW.status := 'en attente';
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.prepare_booking_request() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER booking_requests_prepare BEFORE INSERT ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.prepare_booking_request();

CREATE OR REPLACE FUNCTION public.guard_booking_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'en attente' AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER booking_requests_guard BEFORE UPDATE ON public.booking_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_booking_status();

ALTER TABLE public.booking_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.booking_requests;