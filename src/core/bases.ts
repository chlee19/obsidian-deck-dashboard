interface AppWithInternalPlugins {
  internalPlugins?: {
    getEnabledPluginById?: (id: string) => unknown;
  };
}

/**
 * Whether Obsidian Bases can render here: the core plugin exists in this
 * Obsidian version and is turned on. Checked at runtime so minAppVersion
 * does not have to move.
 */
export function basesAvailable(app: unknown): boolean {
  const ip = (app as AppWithInternalPlugins | null)?.internalPlugins;
  if (typeof ip?.getEnabledPluginById !== "function") return false;
  return Boolean(ip.getEnabledPluginById("bases"));
}

/** Markdown that embeds a .base file (optionally one of its views). */
export function baseEmbedMarkdown(path: string, view: string): string {
  const v = view.trim();
  return v ? `![[${path}#${v}]]` : `![[${path}]]`;
}
