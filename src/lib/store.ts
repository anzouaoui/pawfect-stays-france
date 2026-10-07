import { useEffect, useState } from "react";
import type { Size } from "./data";

export type Dog = { id: string; name: string; breed: string; size: Size; weight: number; behavior: string };
export type BookingRequest = {
  id: string; listingId: string; checkIn: string; checkOut: string; nights: number;
  dogIds: string[]; dogs: Dog[]; message: string; subtotal: number; fee: number;
  status: "en attente" | "acceptée" | "refusée"; createdAt: string;
};

function useLocal<T>(key: string, init: T) {
  const [v, setV] = useState<T>(init);
  useEffect(() => {
    const raw = localStorage.getItem(key);
    if (raw) setV(JSON.parse(raw));
    const on = (e: Event) => { const r = localStorage.getItem(key); if (r) setV(JSON.parse(r)); };
    window.addEventListener("petinn-store", on);
    return () => window.removeEventListener("petinn-store", on);
  }, [key]);
  const set = (next: T) => {
    localStorage.setItem(key, JSON.stringify(next));
    setV(next);
    window.dispatchEvent(new Event("petinn-store"));
  };
  return [v, set] as const;
}

export const useDogs = () => useLocal<Dog[]>("petinn-dogs", []);
export const useRequests = () => useLocal<BookingRequest[]>("petinn-requests", []);
export const uid = () => Math.random().toString(36).slice(2, 10);
