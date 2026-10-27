import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/lib/booking-requests";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Header affordance for the account. It must never claim "Connexion" while a
 * session is live, so the trigger is rendered from the Supabase session itself.
 */
export function AccountMenu() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

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
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (user === undefined) {
    return <Skeleton className="h-9 w-40 rounded-full" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <Button asChild size="sm" className="rounded-full px-4">
        <Link to="/auth">Connexion / Inscription</Link>
      </Button>
    );
  }

  const initial = (user.email?.trim()[0] ?? "P").toUpperCase();

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[15rem] gap-2 rounded-full pl-1.5">
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/10 text-xs text-primary">{initial}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">{user.email}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold">{user.email}</p>
          {roleRow && (
            <p className="mt-0.5 text-xs font-normal text-muted-foreground">
              {roleRow === "hote" ? "Compte hôte" : "Compte voyageur"}
            </p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/mes-voyages" onClick={() => setMenuOpen(false)}>Mes voyages</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/mes-demandes" onClick={() => setMenuOpen(false)}>Mes demandes</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/passeport" onClick={() => setMenuOpen(false)}>Passeport canin</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              to={roleRow === "hote" ? "/mes-annonces" : "/hote"}
              onClick={() => setMenuOpen(false)}
            >
              {roleRow === "hote" ? "Mes annonces" : "Espace hôte"}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={signOut}>
          <LogOut className="size-4" aria-hidden="true" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
