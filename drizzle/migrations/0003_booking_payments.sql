ALTER TABLE public.booking_requests
  ADD COLUMN payment_intent_id text,
  ADD COLUMN payment_status text NOT NULL DEFAULT 'carte requise';

CREATE OR REPLACE FUNCTION public.guard_booking_status()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.status <> OLD.status OR NEW.payment_status <> OLD.payment_status
      OR NEW.payment_intent_id IS DISTINCT FROM OLD.payment_intent_id)
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Modification réservée au serveur de paiement';
  END IF;
  IF NEW.status <> OLD.status AND OLD.status <> 'en attente' THEN
    RAISE EXCEPTION 'Demande déjà traitée';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;