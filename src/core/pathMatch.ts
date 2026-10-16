/**
 * Case-insensitive substring match for folder/file suggestions. Prefix
 * matches come first, then shorter paths.
 */
export function matchPaths(paths: string[], query: string, limit = 50): string[] {
  const q = query.trim().toLowerCase();
  const scored: { p: string; prefix: boolean }[] = [];
  for (const p of paths) {
    const lower = p.toLowerCase();
    if (q && !lower.includes(q)) continue;
    scored.push({ p, prefix: q ? lower.startsWith(q) : false });
  }
  scored.sort(
    (a, b) =>
      Number(b.prefix) - Number(a.prefix) || a.p.length - b.p.length || a.p.localeCompare(b.p)
  );
  return scored.slice(0, limit).map((s) => s.p);
}
