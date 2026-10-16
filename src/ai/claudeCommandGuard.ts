import { Notice } from "obsidian";
import type { DeckSettings } from "../core/settings";
import {
  claudeCommandFrom,
  commandForWidget,
  isExecutableFile,
  warnOnce,
} from "../core/claudeCommand";
import { t } from "../core/i18n";

/**
 * The Claude Code command to run, taken only from Settings → Deck and
 * validated against the file system. Throws a user-facing error otherwise.
 */
export function requireClaudeCommand(settings: DeckSettings): string {
  const check = claudeCommandFrom(settings, isExecutableFile);
  if (!check.ok) throw new Error(t().claudeCommandRejected(check.reason));
  return check.command;
}

// Dashboard values already reported this session (one notice per value).
const reported = new Set<string>();

/**
 * Same as requireClaudeCommand for a widget. A claudeCmd stored in the
 * .dashboard file is not used; when it differs from the setting, the user
 * is told once.
 */
export function requireWidgetClaudeCommand(
  widgetSettings: { claudeCmd?: unknown },
  settings: DeckSettings
): string {
  const { check, ignored } = commandForWidget(widgetSettings, settings, isExecutableFile);
  if (ignored && warnOnce(reported, ignored)) {
    new Notice(t().dashboardCommandIgnored(ignored), 10000);
  }
  if (!check.ok) throw new Error(t().claudeCommandRejected(check.reason));
  return check.command;
}
