CREATE OR REPLACE FUNCTION public.prepare_booking_request()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
  NEW.payment_status := 'carte requise';
  NEW.payment_intent_id := NULL;
  RETURN NEW;
END; $function$;