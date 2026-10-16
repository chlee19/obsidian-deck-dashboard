import { MarkdownRenderer, Setting, TFile } from "obsidian";
import type { WidgetDefinition } from "./types";
import { baseEmbedMarkdown, basesAvailable } from "../core/bases";
import { cleanFolder } from "../core/settings";
import { t } from "../core/i18n";

interface Settings {
  /** Path of a .base file. */
  file: string;
  /** Optional view name inside the base. */
  view: string;
}

const s = t();

export const basesWidget: WidgetDefinition<Settings> = {
  type: "base",
  label: s.basesLabel,
  description: s.basesDescription,
  defaultSettings: () => ({ file: "", view: "" }),
  async render(el, settings, ctx) {
    el.empty();
    el.addClass("nd-widget-base");
    const strings = t();
    if (!basesAvailable(ctx.app)) {
      el.createEl("p", { cls: "nd-empty", text: strings.basesUnavailable });
      return;
    }
    const path = cleanFolder(settings.file);
    if (!path) {
      el.createEl("p", { cls: "nd-empty", text: `${strings.basesFileName}: ${strings.notSetPlaceholder} (⚙)` });
      return;
    }
    const file = ctx.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      el.createEl("p", { cls: "nd-empty", text: strings.basesFileMissing(path) });
      return;
    }
    // Same mechanism as `![[file.base]]` in a note: Obsidian's embed for
    // .base files renders the base. Its children live on ctx.parent.
    await MarkdownRenderer.render(
      ctx.app,
      baseEmbedMarkdown(file.path, settings.view ?? ""),
      el,
      ctx.sourcePath,
      ctx.parent
    );
  },
  renderSettingsForm(container, settings, onChange) {
    const strings = t();
    new Setting(container)
      .setName(strings.basesFileName)
      .setDesc(strings.basesFileDesc)
      .addText((text) =>
        text
          .setPlaceholder("Projects/Tasks.base")
          .setValue(settings.file)
          .onChange((v) => onChange({ ...settings, file: v.trim() }))
      );
    new Setting(container)
      .setName(strings.basesViewName)
      .setDesc(strings.basesViewDesc)
      .addText((text) =>
        text.setValue(settings.view ?? "").onChange((v) => onChange({ ...settings, view: v.trim() }))
      );
  },
};
