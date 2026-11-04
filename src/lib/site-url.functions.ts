import { createServerFn } from "@tanstack/react-start";

/** Exposes the resolved public origin to route heads (canonical, og:url). */
export const getSiteUrl = createServerFn({ method: "GET" }).handler(async () => {
  const { resolveSiteUrl } = await import("./site-url.server");
  return { siteUrl: (await resolveSiteUrl()) ?? null };
});
