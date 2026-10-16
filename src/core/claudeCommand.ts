import type { DeckSettings } from "./settings";

// The Claude Code command is taken from one place only: Settings → Deck,
// which lives in this device's data.json. Values found in .dashboard files
// (vault content that may come from someone else) are never run.

export const DEFAULT_CLAUDE_COMMAND = "claude";

/** True when `path` is an existing file this user may execute. */
export type ExecutableCheck = (path: string) => boolean;

export type CommandCheck =
  | { ok: true; command: string }
  | { ok: false; reason: "empty" | "control-chars" | "not-allowed" | "not-executable" };

/**
 * Allowed: the bare name `claude` (looked up on PATH), or an absolute path
 * to an existing executable file. Everything else — other bare names,
 * relative paths (they would resolve inside the vault), line breaks, NUL —
 * is rejected. The value is still shell-quoted when it is run.
 */
export function validateClaudeCommand(value: string, isExecutable: ExecutableCheck): CommandCheck {
  if (/[\r\n\0]/.test(value)) return { ok: false, reason: "control-chars" };
  const cmd = value.trim();
  if (!cmd) return { ok: false, reason: "empty" };
  if (cmd === DEFAULT_CLAUDE_COMMAND) return { ok: true, command: cmd };
  if (!cmd.startsWith("/")) return { ok: false, reason: "not-allowed" };
  if (!isExecutable(cmd)) return { ok: false, reason: "not-executable" };
  return { ok: true, command: cmd };
}

/** The command from Settings → Deck ("claude" when empty), validated. */
export function claudeCommandFrom(settings: DeckSettings, isExecutable: ExecutableCheck): CommandCheck {
  return validateClaudeCommand(settings.claudeCommand.trim() || DEFAULT_CLAUDE_COMMAND, isExecutable);
}

/**
 * Command for a widget: always the plugin setting. `ignored` is the value
 * the .dashboard file asked for when it differs, so the user can be told.
 */
export function commandForWidget(
  widgetSettings: { claudeCmd?: unknown },
  settings: DeckSettings,
  isExecutable: ExecutableCheck
): { check: CommandCheck; ignored: string | null } {
  const check = claudeCommandFrom(settings, isExecutable);
  const asked = typeof widgetSettings.claudeCmd === "string" ? widgetSettings.claudeCmd.trim() : "";
  const configured = settings.claudeCommand.trim() || DEFAULT_CLAUDE_COMMAND;
  return { check, ignored: asked && asked !== configured ? asked : null };
}

/** True the first time `key` is seen (to show a notice only once). */
export function warnOnce(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

/** Desktop check against the real file system: an executable regular file. */
export function isExecutableFile(path: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef -- fs is desktop-only; lazy require keeps it out of the mobile bundle
    const fs = require("fs") as typeof import("fs");
    if (!fs.statSync(path).isFile()) return false;
    fs.accessSync(path, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
