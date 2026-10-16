import type { WidgetContext } from "./types";
import type { TokenFolderKey } from "../core/pathTokens";
import { t, type Strings } from "../core/i18n";
import { renderFolderNotice } from "./setupNotice";

const LABEL: Record<TokenFolderKey, keyof Strings> = {
  taskFolder: "taskFolderName",
  meetingNotesFolder: "meetingFolderName",
  dailyNotesFolder: "dailyFolderName",
};

/** A query uses {{token}}s whose folders are not set yet. */
export function renderTokenNotice(el: HTMLElement, ctx: WidgetContext, missing: TokenFolderKey[]): void {
  const s = t();
  const labels = missing.map((k) => s[LABEL[k]] as string).join(" / ");
  renderFolderNotice(el, ctx, labels);
}
