ALTER TABLE public.booking_requests DROP CONSTRAINT booking_requests_status_check;
ALTER TABLE public.booking_requests ADD CONSTRAINT booking_requests_status_check CHECK (status IN ('en attente','acceptée','refusée','annulée'));

CREATE POLICY "Travelers cancel own pending requests" ON public.booking_requests
  FOR UPDATE TO authenticated USING (auth.uid() = traveler_id) WITH CHECK (auth.uid() = traveler_id AND status = 'annulée');

CREATE OR REPLACE FUNCTION public.guard_booking_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status THEN
    IF OLD.status <> 'en attente' THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;
    IF NEW.status = 'annulée' AND auth.uid() IS DISTINCT FROM OLD.traveler_id THEN RAISE EXCEPTION 'Seul le voyageur peut annuler'; END IF;
    IF NEW.status IN ('acceptée','refusée') AND auth.uid() IS DISTINCT FROM OLD.host_id THEN RAISE EXCEPTION 'Seul l''hôte peut décider'; END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;