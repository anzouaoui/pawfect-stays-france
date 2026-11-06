/**
 * Shared test doubles for the authentication pages: router, Supabase auth + user_roles,
 * session store (what onAuthStateChange would update) and toasts.
 * Import this module BEFORE the page under test, after declaring the vi.mock calls that
 * point to it (see auth-flows.test.tsx).
 */
import { vi } from "vitest";
import { useSyncExternalStore, type ReactNode } from "react";

type User = { id: string; email: string };

/** Session store standing in for Supabase's onAuthStateChange. */
export const session = (() => {
  let user: User | null | undefined = null;
  const listeners = new Set<() => void>();
  return {
    get: () => user,
    set: (u: User | null | undefined) => { user = u; listeners.forEach((l) => l()); },
    subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); },
  };
})();
export function useSessionUser() {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}

/** user_roles table: user id → role. */
export const roles = new Map<string, string>();

export const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  getUser: vi.fn(async () => ({ data: { user: session.get() ?? null }, error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => ({ error: null })),
};
export const upsert = vi.fn(async (row: { user_id: string; role: string }) => {
  if (!roles.has(row.user_id)) roles.set(row.user_id, row.role); // ignoreDuplicates
  return { error: null };
});
export const supabase = {
  auth,
  from: (table: string) => {
    if (table !== "user_roles") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({ eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: roles.has(id) ? { role: roles.get(id) } : null, error: null }) }) }),
      upsert,
    };
  },
};

export const navigate = vi.fn();
export const routerState = { search: {} as Record<string, unknown>, pathname: "/" };
export const routerMock = {
  createFileRoute: () => (options: Record<string, unknown>) => ({ options, useSearch: () => routerState.search }),
  useNavigate: () => navigate,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) => select({ location: { pathname: routerState.pathname } }),
  Link: ({ to, children, ...rest }: { to: string; children: ReactNode }) => <a href={to} {...rest}>{children}</a>,
};

export const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
export const lovable = { auth: { signInWithOAuth: vi.fn() } };

export function resetAuthHarness() {
  vi.clearAllMocks();
  roles.clear();
  localStorage.clear();
  session.set(null);
  routerState.search = {};
  routerState.pathname = "/";
}

/** Render helper: the route component of a page module. */
export function pageOf(route: unknown) {
  return (route as { options: { component: () => ReactNode } }).options.component;
}
