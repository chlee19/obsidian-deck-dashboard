// Frontmatter values written by the plugin (task notes, sheet rows) are
// single-line YAML scalars: line breaks and control characters become
// spaces, and anything YAML would read differently is double-quoted.

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_ALL = /[\u0000-\u001f\u007f]+/g;

function needsQuotes(v: string): boolean {
  if (v !== v.trim()) return true;
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(v)) return true;
  if (v.includes(": ") || v.endsWith(":") || v.includes(" #") || v.includes('"')) return true;
  return false;
}

export function formatYamlScalar(value: string): string {
  const v = value.replace(CONTROL_ALL, " ");
  return needsQuotes(v) ? JSON.stringify(v) : v;
}

/** Read back a scalar written by formatYamlScalar (or a hand-quoted one). */
export function parseYamlScalar(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v;
    }
  }
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) {
    return v.slice(1, -1).replace(/''/g, "'");
  }
  return v;
}
