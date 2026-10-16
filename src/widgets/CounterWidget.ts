import { Setting } from "obsidian";
import type { WidgetDefinition } from "./types";
import { getDataviewApi } from "../adapters/dataview";
import { renderTokenNotice } from "./tokenNotice";
import { expandFolderTokens } from "../core/pathTokens";

interface Settings {
  query: string;
  label: string;
  unit: string;
}

export const counterWidget: WidgetDefinition<Settings> = {
  type: "counter",
  label: "Counter / KPI",
  description: "Dataviewクエリの結果件数を大きな数字で表示する。",
  defaultSettings: () => ({
    query: 'LIST FROM "{{taskFolder}}" WHERE status != "完了"',
    label: "未完了タスク",
    unit: "件",
  }),
  async render(el, settings, ctx) {
    el.empty();
    el.addClass("nd-widget-counter");
    const dv = getDataviewApi(ctx.app);
    if (!dv) {
      el.createEl("p", { cls: "nd-empty", text: "Dataview プラグインが必要です。" });
      return;
    }
    const expanded = expandFolderTokens(settings.query, ctx.settings);
    if (!expanded.ok) {
      renderTokenNotice(el, ctx, expanded.missing);
      return;
    }
    let count: number | string = "?";
    try {
      const res = await dv.tryQuery(expanded.query);
      if (res?.values?.length !== undefined) {
        count = res.values.length;
      } else if (Array.isArray(res?.rows)) {
        count = res.rows.length;
      } else {
        count = 0;
      }
    } catch (e) {
      el.createEl("pre", { cls: "nd-error", text: `Counter error: ${(e as Error).message}` });
      return;
    }
    const wrap = el.createDiv({ cls: "nd-counter-wrap" });
    const num = wrap.createDiv({ cls: "nd-counter-number" });
    num.setText(String(count));
    if (settings.unit) num.createSpan({ cls: "nd-counter-unit", text: settings.unit });
    wrap.createDiv({ cls: "nd-counter-label", text: settings.label });
  },
  renderSettingsForm(container, settings, onChange) {
    new Setting(container)
      .setName("ラベル")
      .addText((t) => t.setValue(settings.label).onChange((v) => onChange({ ...settings, label: v })));
    new Setting(container)
      .setName("単位")
      .setDesc("件 / 個 / %")
      .addText((t) => t.setValue(settings.unit).onChange((v) => onChange({ ...settings, unit: v })));
    new Setting(container)
      .setName("Dataview LIST クエリ")
      .setDesc("結果の件数をカウントする。例: LIST FROM \"{{taskFolder}}\" WHERE status != \"完了\"。{{taskFolder}} / {{meetingFolder}} / {{dailyFolder}} は 設定 → Deck のフォルダに置き換わります")
      .addTextArea((t) => {
        t.setValue(settings.query);
        t.inputEl.rows = 4;
        t.inputEl.addClass("deck-input-full");
        t.inputEl.addClass("deck-input-mono");
        t.onChange((v) => onChange({ ...settings, query: v }));
      });
  },
};
