// iCal calendars: private addresses are registered by name in Settings →
// Deck (kept with the other secrets), so .dashboard files only carry the
// name. Every address is checked before anything is fetched.

export type UrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid" | "scheme" | "private" };

function isPrivateIPv4(host: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("::ffff:")) return true; // IPv4-mapped: treat as local
  return /^f[cd]/.test(h) || /^fe[89ab]/.test(h);
}

/** Loopback, private, link-local or local-only host names. */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.includes(":")) return isPrivateIPv6(h);
  return isPrivateIPv4(h);
}

/**
 * Only http(s) is fetched (webcal:// is treated as https://). Local and
 * private-network hosts are refused unless the user allowed them. The check
 * is on the address as written; it does not resolve DNS names.
 */
export function checkCalendarUrl(input: string, allowPrivate: boolean): UrlCheck {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol === "webcal:") {
    url = new URL("https:" + url.href.slice("webcal:".length));
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "scheme" };
  if (!allowPrivate && isLocalHost(url.hostname)) return { ok: false, reason: "private" };
  return { ok: true, url: url.href };
}

export type CalendarSource =
  | { kind: "url"; url: string; fromName: boolean }
  | { kind: "unknown-name"; name: string }
  | { kind: "unset" };

/**
 * The address a Calendar widget should read: a name registered in Settings →
 * Deck, or (older dashboards) a URL written in the widget itself.
 */
export function resolveCalendarSource(
  widget: { source?: unknown; icalUrl?: unknown },
  sources: Record<string, string>
): CalendarSource {
  const name = typeof widget.source === "string" ? widget.source.trim() : "";
  if (name) {
    const url = Object.prototype.hasOwnProperty.call(sources, name) ? sources[name] : undefined;
    return typeof url === "string" && url ? { kind: "url", url, fromName: true } : { kind: "unknown-name", name };
  }
  const url = typeof widget.icalUrl === "string" ? widget.icalUrl.trim() : "";
  return url ? { kind: "url", url, fromName: false } : { kind: "unset" };
}
