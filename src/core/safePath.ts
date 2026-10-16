// Every path the plugin writes to goes through safeVaultPath: values may
// come from synced .dashboard files or from a shared spreadsheet, so they
// must never reach outside the folder they are meant for.

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL = /[\u0000-\u001f\u007f]/;
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_ALL = /[\u0000-\u001f\u007f]+/g;

export type SafePath = { ok: true; path: string } | { ok: false; reason: string };

/**
 * Validate a vault-relative path and make sure it lies inside `under`
 * ("" = anywhere in the vault). Refuses absolute paths, drive letters,
 * backslashes, control characters, and segments that are "..", "." or
 * start with "." (hidden folders such as the config folder).
 */
export function safeVaultPath(path: string, under: string): SafePath {
  if (CONTROL.test(path)) return { ok: false, reason: "control characters" };
  if (path.includes("\\")) return { ok: false, reason: "backslash" };
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) return { ok: false, reason: "absolute path" };
  const parts = path.split("/").filter((p) => p !== "");
  if (parts.length === 0) return { ok: false, reason: "empty path" };
  for (const p of parts) {
    if (p.startsWith(".")) return { ok: false, reason: `"${p}" is not allowed` };
  }
  const normalized = parts.join("/");
  const base = under.split("/").filter((p) => p !== "").join("/");
  if (base && normalized !== base && !normalized.startsWith(base + "/")) {
    return { ok: false, reason: `outside "${base}"` };
  }
  return { ok: true, path: normalized };
}

/** Like safeVaultPath, but throws a readable error. */
export function requireSafeVaultPath(path: string, under: string): string {
  const r = safeVaultPath(path, under);
  if (!r.ok) throw new Error(`Refused to write to "${path.replace(CONTROL_ALL, " ")}": ${r.reason}.`);
  return r.path;
}

/** One folder name (no separators, "..", hidden or control characters), or null. */
export function safeFolderName(name: string): string | null {
  if (CONTROL.test(name)) return null;
  const n = name.trim();
  if (!n || n.includes("/") || n.includes("\\") || n.startsWith(".")) return null;
  return n;
}

/** A title turned into a file name: no separators, no control characters. */
export function sanitizeFileTitle(title: string): string {
  const cleaned = title
    .replace(CONTROL_ALL, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  return cleaned || "Untitled";
}
