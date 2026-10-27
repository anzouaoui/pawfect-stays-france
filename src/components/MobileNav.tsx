import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/booking-requests";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { to: "/passeport", label: "Passeport canin" },
  { to: "/mes-demandes", label: "Mes demandes" },
  { to: "/mes-voyages", label: "Mes voyages" },
  { to: "/mes-annonces", label: "Mes annonces" },
  { to: "/hote", label: "Espace hôte" },
] as const;

const LINK_CLASS = "rounded-md px-3 py-2.5 hover:bg-accent/10";

/** Mobile navigation drawer (hamburger). Hidden from `sm:` up, where the inline nav links show. */
export function MobileNav() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: roleRow } = useQuery({
    queryKey: ["account-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.role ?? null;
    },
  });

  const signOut = async () => {
    setOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="sm:hidden" aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-72">
        <SheetHeader>
          <SheetTitle className="font-display text-left text-xl">
            Pet<span className="text-accent">Inn</span>
          </SheetTitle>
        </SheetHeader>
        <nav className="mt-6 flex flex-col gap-1 text-base">
          <Link
            to="/recherche"
            search={{ q: "", type: "", from: "", to: "" }}
            onClick={() => setOpen(false)}
            activeProps={{ className: "font-semibold text-primary" }}
            className={LINK_CLASS}
          >
            Rechercher
          </Link>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              activeProps={{ className: "font-semibold text-primary" }}
              className={LINK_CLASS}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t pt-4">
          {user ? (
            <div className="flex flex-col gap-3">
              <div className="px-3">
                <p className="truncate text-sm font-semibold">{user.email}</p>
                {roleRow && (
                  <p className="text-xs text-muted-foreground">
                    {roleRow === "hote" ? "Compte hôte" : "Compte voyageur"}
                  </p>
                )}
              </div>
              <Button variant="outline" className="justify-start gap-2 text-destructive" onClick={signOut}>
                <LogOut className="size-4" aria-hidden="true" />
                Se déconnecter
              </Button>
            </div>
          ) : (
            <Button asChild className="w-full rounded-full">
              <Link to="/auth" onClick={() => setOpen(false)}>
                Connexion / Inscription
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
