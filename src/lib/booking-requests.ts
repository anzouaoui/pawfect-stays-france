import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { BookingRequest, Dog } from "@/lib/store";

export type BookingRow = Tables<"booking_requests">;

export function toRequest(r: BookingRow): BookingRequest {
  return {
    id: r.id, listingId: r.listing_id, listingName: r.listing_name, checkIn: r.check_in, checkOut: r.check_out,
    nights: r.nights, dogs: (Array.isArray(r.dogs) ? r.dogs : []) as unknown as Dog[], dogIds: [],
    message: r.message, subtotal: Number(r.subtotal), fee: Number(r.fee),
    status: r.status as BookingRequest["status"], createdAt: r.created_at,
  };
}

/** Current signed-in user, read on the client only (undefined while loading). */
export function useSessionUser() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      revision += 1;
      if (active) setUser(s?.user ?? null);
    });
    const startedAt = revision;
    supabase.auth.getUser().then(({ data }) => {
      if (active && revision === startedAt) setUser(data.user ?? null);
    }).catch(() => {
      if (active && revision === startedAt) setUser(null);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  return user;
}

/** Live list of booking requests where the user is traveler or host, kept in sync via realtime. */
export function useLiveRequests(user: User | null | undefined, role: "traveler" | "host") {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!user) { setRows(null); return; }
    const col = role === "traveler" ? "traveler_id" : "host_id";
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from("booking_requests").select("*").eq(col, user.id).order("created_at", { ascending: false });
      if (!active) return;
      if (error) { setError(true); return; }
      setRows(data);
    };
    load();
    const channel = supabase
      .channel(`booking-${role}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_requests", filter: `${col}=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [user, role]);
  return { rows, error };
}
