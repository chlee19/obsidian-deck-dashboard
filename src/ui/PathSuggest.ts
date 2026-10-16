import { AbstractInputSuggest, TFile, TFolder } from "obsidian";
import type { App } from "obsidian";
import { matchPaths } from "../core/pathMatch";

/** What a PathSuggest offers: folders, or files with one of the extensions. */
export type PathKind = { folders: true } | { extensions: string[] };

/**
 * Type-ahead for settings inputs: suggests existing folders (or files) of the
 * vault while the user types, so paths don't have to be typed from memory.
 */
export class PathSuggest extends AbstractInputSuggest<string> {
  constructor(
    app: App,
    private readonly input: HTMLInputElement,
    private readonly kind: PathKind
  ) {
    super(app, input);
  }

  protected getSuggestions(query: string): string[] {
    const paths: string[] = [];
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if ("folders" in this.kind) {
        if (f instanceof TFolder && f.path !== "/" && f.path !== "") paths.push(f.path);
      } else if (f instanceof TFile && this.kind.extensions.includes(f.extension)) {
        paths.push(f.path);
      }
    }
    return matchPaths(paths, query, 50);
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  selectSuggestion(value: string): void {
    this.setValue(value);
    // Let the Setting's onChange handler see the picked value.
    this.input.dispatchEvent(new Event("input"));
    this.close();
  }
}
