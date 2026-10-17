/**
 * Accept only same-origin relative paths for post-login redirects, to prevent open redirects
 * such as `//evil.example` or `https://evil.example`.
 */
export function safeNextPath(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://fitgrid.local");
    if (url.origin !== "http://fitgrid.local") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
