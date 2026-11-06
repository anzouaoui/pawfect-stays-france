-- 0009 — Contrôle des chiens dans la base (trigger prepare_booking_request)
--
-- Pourquoi : les utilisateurs connectés ont le droit d'insérer directement dans
-- booking_requests (GRANT INSERT TO authenticated). Le serveur (createBookingWithHold)
-- vérifie déjà les chiens, mais une insertion directe passait outre : seul le NOMBRE de
-- chiens était contrôlé, pas leur gabarit ni leur appartenance au voyageur.
--
-- Ce que fait cette version (reprend 0004_booking_payments_insert_guard.sql et ajoute) :
--   1. chaque chien doit être un passeport canin du voyageur (dog_profiles.owner_id) ;
--   2. aucun chien en double ;
--   3. le gabarit de chaque chien, lu dans dog_profiles (pas dans la requête), doit faire
--      partie des gabarits acceptés par le logement (host_listings.sizes) ;
--   4. la copie des chiens stockée dans la demande est réécrite depuis dog_profiles, ce qui
--      empêche d'enregistrer un nom, un poids ou un comportement falsifié.
-- Tout le reste est inchangé : logement publié, pas sa propre annonce, séjour minimum,
-- disponibilités, nombre de chiens, calcul des prix, statuts initiaux.

CREATE OR REPLACE FUNCTION public.prepare_booking_request()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  l public.host_listings;
  n int;
  dog_count int;
  dog_ids uuid[];
  found_count int;
  rejected text;
  snapshot jsonb;
BEGIN
  SELECT * INTO l FROM public.host_listings WHERE id = NEW.listing_id AND status = 'publiée';
  IF NOT FOUND THEN RAISE EXCEPTION 'Logement indisponible'; END IF;
  IF l.owner_id = NEW.traveler_id THEN RAISE EXCEPTION 'Vous ne pouvez pas réserver votre propre logement'; END IF;
  n := NEW.check_out - NEW.check_in;
  IF n < l.min_nights THEN RAISE EXCEPTION 'Séjour trop court'; END IF;
  IF NEW.check_in < l.available_from OR NEW.check_out > l.available_to
     OR EXISTS (SELECT 1 FROM unnest(l.blocked_dates) d WHERE d >= NEW.check_in AND d < NEW.check_out) THEN
    RAISE EXCEPTION 'Dates indisponibles';
  END IF;

  -- Chiens : nombre accepté par le logement
  IF jsonb_typeof(NEW.dogs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Nombre de chiens non accepté'; END IF;
  dog_count := jsonb_array_length(NEW.dogs);
  IF dog_count < 1 OR dog_count > l.max_dogs THEN RAISE EXCEPTION 'Nombre de chiens non accepté'; END IF;

  -- Identifiants des passeports choisis (un identifiant invalide ou manquant est refusé)
  BEGIN
    SELECT array_agg((e->>'id')::uuid) INTO dog_ids FROM jsonb_array_elements(NEW.dogs) e;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Chien absent du passeport canin';
  END;
  IF (SELECT count(DISTINCT x) FROM unnest(dog_ids) x) <> dog_count THEN
    RAISE EXCEPTION 'Chien absent du passeport canin ou sélectionné plusieurs fois';
  END IF;

  -- Passeports du voyageur : appartenance, gabarit accepté, copie fidèle
  SELECT count(*),
         string_agg(CASE WHEN NOT (p.size = ANY (l.sizes)) THEN p.name || ' (' || p.size || ')' END, ', '),
         jsonb_agg(jsonb_build_object(
           'id', p.id, 'name', p.name, 'breed', p.breed, 'size', p.size,
           'weight', p.weight, 'behavior', p.behavior
         ) ORDER BY array_position(dog_ids, p.id))
    INTO found_count, rejected, snapshot
    FROM public.dog_profiles p
   WHERE p.id = ANY (dog_ids) AND p.owner_id = NEW.traveler_id;
  IF found_count <> dog_count THEN RAISE EXCEPTION 'Chien absent du passeport canin'; END IF;
  IF rejected IS NOT NULL THEN RAISE EXCEPTION 'Gabarit non accepté dans ce logement : %', rejected; END IF;

  NEW.dogs := snapshot;
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

REVOKE EXECUTE ON FUNCTION public.prepare_booking_request() FROM PUBLIC, anon, authenticated;
