import type { App, Component, Plugin } from "obsidian";
import type { DeckSettings } from "../core/settings";

export interface WidgetContext {
  app: App;
  plugin: Plugin;
  /** Owns everything this widget registers; unloaded before the next render. */
  parent: Component;
  sourcePath: string;
  /** Plugin-wide settings (folders etc.). */
  settings: DeckSettings;
  /** Open Settings → Deck. */
  openSettings: () => void;
}

export interface WidgetDefinition<TSettings = unknown> {
  type: string;
  label: string;
  description: string;
  defaultSettings: () => TSettings;
  render(el: HTMLElement, settings: TSettings, ctx: WidgetContext): void | Promise<void>;
  renderSettingsForm(container: HTMLElement, settings: TSettings, onChange: (next: TSettings) => void): void;
}
