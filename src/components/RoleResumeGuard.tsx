import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useSessionUser } from "@/lib/booking-requests";
import { readAccountRole } from "@/lib/auth-account";
import { shouldResumeRoleChoice } from "@/lib/auth-redirect";

/**
 * Reprend le choix du type de compte : un utilisateur connecté qui a quitté
 * l'écran de bienvenue sans choisir Voyageur ou Hôte est ramené à /auth,
 * puis renvoyé vers sa page d'origine une fois le rôle enregistré.
 */
export function RoleResumeGuard() {
  const user = useSessionUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: role } = useQuery({
    queryKey: ["account-role", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => readAccountRole(user!.id),
  });

  useEffect(() => {
    if (!user || role === undefined) return;
    if (shouldResumeRoleChoice(pathname, role)) {
      navigate({ to: "/auth", search: { redirect: pathname }, replace: true });
    }
  }, [user, role, pathname, navigate]);

  return null;
}
