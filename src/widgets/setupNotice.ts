import type { WidgetContext } from "./types";
import { t } from "../core/i18n";

/**
 * Shown instead of an empty widget when a folder or file it needs is not
 * configured yet: what to set, and a button that opens Settings → Deck.
 */
export function renderSetupNotice(el: HTMLElement, ctx: WidgetContext, message: string): void {
  const box = el.createDiv({ cls: "nd-empty nd-setup-notice" });
  box.createEl("p", { text: message });
  const btn = box.createEl("button", { cls: "mod-cta", text: t().openSettings });
  btn.addEventListener("click", () => ctx.openSettings());
}

/** Shorthand for "set the <label> folder". */
export function renderFolderNotice(el: HTMLElement, ctx: WidgetContext, label: string): void {
  renderSetupNotice(el, ctx, t().folderNotSet(label));
}
