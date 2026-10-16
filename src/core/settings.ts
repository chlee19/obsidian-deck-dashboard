// Plugin-wide settings: where the user's notes live and how the home
// dashboard behaves. Stored under one key in data.json next to the other
// (older) keys such as sync_config and mail_config.

export interface DeckSettings {
  /** Notes with task frontmatter (Kanban, Gantt, Charts, Task creator, Sheets sync). */
  taskFolder: string;
  /** Daily notes (Today widget). Empty = core Daily notes plugin, if enabled. */
  dailyNotesFolder: string;
  /** Meeting notes ({{meetingFolder}} token in Dataview queries). */
  meetingNotesFolder: string;
  /** Markwhen (.mw) file for the Gantt widget. */
  markwhenFile: string;
  /** Where "Create new dashboard" puts files. Empty = vault root. */
  dashboardFolder: string;
  /** Home dashboard file. Empty = DEFAULT_HOME_PATH. */
  homeDashboard: string;
  /** AI delegation run logs. Required for delegation. */
  aiLogFolder: string;
  /** Sheets sync logs. Empty = no log file. */
  syncLogFolder: string;
  /** Notes saved from the AI search widget. */
  aiNotesFolder: string;
  /** Always skipped by AI search / AI mail replies. */
  searchExcludeFolders: string[];
  openHomeOnStartup: boolean;
  /**
   * Claude Code executable used by AI search, AI mail replies and AI
   * delegation. Only read from here (this device's data.json), never from
   * .dashboard files. See core/claudeCommand.ts for what is allowed.
   */
  claudeCommand: string;
}

/** Key in data.json. */
export const SETTINGS_KEY = "deck_settings";

export const DEFAULT_HOME_PATH = "Home.dashboard";

/** Where 0.0.x always created the home dashboard. */
export const LEGACY_HOME_PATH = "ダッシュボード/ホーム.dashboard";

/** Mail RAG folders 0.0.x used when the user never saved mail settings. */
export const LEGACY_RAG_FOLDERS = ["議事録", "ナレッジ"];

/** New installs: nothing points at folders that may not exist. */
export const FRESH_SETTINGS: DeckSettings = {
  taskFolder: "",
  dailyNotesFolder: "",
  meetingNotesFolder: "",
  markwhenFile: "",
  dashboardFolder: "",
  homeDashboard: DEFAULT_HOME_PATH,
  aiLogFolder: "",
  syncLogFolder: "",
  aiNotesFolder: "",
  searchExcludeFolders: [],
  openHomeOnStartup: false,
  claudeCommand: "claude",
};

/**
 * Paths that 0.0.x had hard-coded. Users upgrading from those versions keep
 * them, so their widgets, logs and sync keep reading the same places.
 */
export const LEGACY_SETTINGS: DeckSettings = {
  taskFolder: "タスク/詳細",
  dailyNotesFolder: "日報",
  meetingNotesFolder: "議事録",
  markwhenFile: "タスク/ガント.mw",
  dashboardFolder: "ダッシュボード",
  homeDashboard: LEGACY_HOME_PATH,
  aiLogFolder: "ログ/AI移譲",
  syncLogFolder: "ログ/sync",
  aiNotesFolder: "inbox/temp",
  searchExcludeFolders: ["ログ", "アーカイブ", "添付", "inbox/temp"],
  openHomeOnStartup: false,
  claudeCommand: "claude",
};

/** What a plugin exposes to views, widgets and helpers. */
export interface DeckHost {
  settings: DeckSettings;
  openSettings(): void;
}

export interface MigrationResult {
  /** data.json contents to save (a copy; the input is not mutated). */
  data: Record<string, unknown>;
  settings: DeckSettings;
  /** True when `data` differs from the input and should be saved. */
  changed: boolean;
  /** True when the defaults came from LEGACY_SETTINGS. */
  legacy: boolean;
}

type PlainObject = Record<string, unknown>;

function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** "  /a//b/ " → "a/b". Non-strings become "". */
export function cleanFolder(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function cleanFolderList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const v of value) {
    const f = cleanFolder(v);
    if (f && !out.includes(f)) out.push(f);
  }
  return out;
}

function pickSettings(stored: PlainObject, defaults: DeckSettings, mail: PlainObject): DeckSettings {
  const str = (key: keyof DeckSettings): string =>
    typeof stored[key] === "string" ? cleanFolder(stored[key]) : (defaults[key] as string);
  const home =
    typeof stored.homeDashboard === "string" ? stored.homeDashboard.trim() : defaults.homeDashboard;
  return {
    taskFolder: str("taskFolder"),
    dailyNotesFolder: str("dailyNotesFolder"),
    meetingNotesFolder: str("meetingNotesFolder"),
    markwhenFile: str("markwhenFile"),
    dashboardFolder: str("dashboardFolder"),
    homeDashboard: home,
    aiLogFolder: str("aiLogFolder"),
    syncLogFolder: str("syncLogFolder"),
    aiNotesFolder: str("aiNotesFolder"),
    searchExcludeFolders:
      cleanFolderList(stored.searchExcludeFolders) ?? [...defaults.searchExcludeFolders],
    openHomeOnStartup:
      typeof stored.openHomeOnStartup === "boolean"
        ? stored.openHomeOnStartup
        : defaults.openHomeOnStartup,
    claudeCommand: pickClaudeCommand(stored, mail, defaults),
  };
}

// Before 0.1.0 the mail settings had their own command; carry it over once.
function pickClaudeCommand(stored: PlainObject, mail: PlainObject, defaults: DeckSettings): string {
  if (typeof stored.claudeCommand === "string") return stored.claudeCommand.trim();
  if (typeof mail.claudeCmd === "string" && mail.claudeCmd.trim()) return mail.claudeCmd.trim();
  return defaults.claudeCommand;
}

/**
 * Resolve settings from raw data.json contents.
 *
 * - No data.json and no old home dashboard → fresh install: folders unset.
 * - data.json without our key (or an old home dashboard in the vault) →
 *   upgrade from 0.0.x: keep the folders that version had hard-coded.
 * - Our key present → use what is stored; fill gaps with fresh defaults.
 */
export function migratePluginData(
  raw: unknown,
  opts: { legacyHomeExists: boolean }
): MigrationResult {
  const input: PlainObject = isPlainObject(raw) ? raw : {};
  const storedSettings = input[SETTINGS_KEY];
  const legacy = !isPlainObject(storedSettings) && (isPlainObject(raw) || opts.legacyHomeExists);
  const defaults = legacy ? LEGACY_SETTINGS : FRESH_SETTINGS;
  const mailConfig = isPlainObject(input.mail_config) ? input.mail_config : {};
  const settings = pickSettings(isPlainObject(storedSettings) ? storedSettings : {}, defaults, mailConfig);

  const data: PlainObject = { ...input, [SETTINGS_KEY]: settings };

  if (legacy) {
    const mail = isPlainObject(input.mail_config) ? input.mail_config : {};
    if (!Array.isArray(mail.ragFolders)) {
      data.mail_config = { ...mail, ragFolders: [...LEGACY_RAG_FOLDERS] };
    }
  }

  const changed =
    !isPlainObject(raw) ||
    JSON.stringify(storedSettings) !== JSON.stringify(settings) ||
    data.mail_config !== input.mail_config;
  return { data, settings, changed, legacy };
}

/** Widget value when set, otherwise the plugin-wide folder. */
export function effectiveFolder(widgetValue: unknown, globalValue: string): string {
  return cleanFolder(widgetValue) || cleanFolder(globalValue);
}

export function homeDashboardPath(s: DeckSettings): string {
  const p = s.homeDashboard.trim().replace(/^\/+/, "");
  if (!p) return DEFAULT_HOME_PATH;
  return p.endsWith(".dashboard") ? p : `${p}.dashboard`;
}

/** Folder for new dashboards; "" = vault root. */
export function dashboardFolderPath(s: DeckSettings): string {
  return cleanFolder(s.dashboardFolder);
}

/** Folders AI search / mail RAG must skip. */
export function searchExcludes(s: DeckSettings, widgetExcludes: string[] = []): string[] {
  const out: string[] = [];
  for (const f of [...s.searchExcludeFolders, s.aiLogFolder, s.syncLogFolder, ...widgetExcludes]) {
    const c = cleanFolder(f);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}

/** Settings of a DeckHost, or fresh defaults for anything else (tests, stubs). */
export function settingsOf(host: unknown): DeckSettings {
  if (typeof host !== "object" || host === null) return FRESH_SETTINGS;
  return (host as Partial<DeckHost>).settings ?? FRESH_SETTINGS;
}
