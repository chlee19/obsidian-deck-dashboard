/** The part of a WorkspaceLeaf we need: its saved view state. */
export interface LeafWithState {
  getViewState(): { type: string; state?: Record<string, unknown> };
}

/**
 * The leaf that shows `path`, if any. Reads the file from the view state so
 * tabs restored at startup but not loaded yet (deferred views) count too.
 */
export function findLeafShowingFile<T extends LeafWithState>(leaves: T[], path: string): T | null {
  for (const leaf of leaves) {
    const file = leaf.getViewState().state?.file;
    if (file === path) return leaf;
  }
  return null;
}

/**
 * Where to open the home dashboard on startup: reuse an empty tab, otherwise
 * open a new one so the note the user left open is not replaced.
 */
export function startupLeafMode(activeViewType: string | undefined): "reuse" | "tab" {
  return activeViewType === "empty" ? "reuse" : "tab";
}
