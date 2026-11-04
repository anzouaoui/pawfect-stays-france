/**
 * Public origin of the site (e.g. "https://petinn.fr"), resolved on the server.
 * 1. `SITE_URL` env variable — set it to the custom domain in production so every
 *    absolute link (emails, canonical, og:url) points to one domain.
 * 2. Fallback: origin of the current request (works on any domain, incl. previews).
 * Returns undefined outside a request when SITE_URL is not set.
 */
export async function resolveSiteUrl(): Promise<string | undefined> {
  const fromEnv = normalizeOrigin(process.env["SITE_URL"]);
  if (fromEnv) return fromEnv;
  try {
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const url = new URL(request.url);
    if (forwardedHost) return normalizeOrigin(`${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost}`);
    return normalizeOrigin(url.origin);
  } catch {
    return undefined;
  }
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
