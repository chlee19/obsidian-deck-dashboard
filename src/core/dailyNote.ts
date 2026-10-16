import { cleanFolder } from "./settings";

export type DailyFormat = "YYYY-MM-DD" | "YYYY/MM/DD" | "YYYY/YYYY-MM-DD";

/** Folder and moment date format of the core Daily notes plugin. */
export interface CoreDailyNotes {
  folder: string;
  format: string;
}

export type DailyNoteTarget =
  | { kind: "path"; path: string; source: "widget" | "settings" | "core" }
  | { kind: "unset" };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function join(folder: string, file: string): string {
  const f = cleanFolder(folder);
  return f ? `${f}/${file}` : file;
}

export function formatDailyPath(format: DailyFormat, folder: string, d: Date): string {
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  switch (format) {
    case "YYYY/MM/DD":
      return join(folder, `${y}/${m}/${y}-${m}-${day}.md`);
    case "YYYY/YYYY-MM-DD":
      return join(folder, `${y}/${y}-${m}-${day}.md`);
    case "YYYY-MM-DD":
    default:
      return join(folder, `${y}-${m}-${day}.md`);
  }
}

/**
 * Where today's daily note lives. Order: the widget's own folder (existing
 * dashboards), the plugin setting, then the core Daily notes plugin.
 */
export function resolveDailyNote(input: {
  widgetFolder?: string;
  widgetFormat?: DailyFormat;
  settingsFolder: string;
  core: CoreDailyNotes | null;
  now: Date;
  /** moment(now).format(fmt) — injected so this stays pure. */
  formatMoment: (fmt: string) => string;
}): DailyNoteTarget {
  const format = input.widgetFormat ?? "YYYY-MM-DD";
  const widgetFolder = cleanFolder(input.widgetFolder);
  if (widgetFolder) {
    return { kind: "path", path: formatDailyPath(format, widgetFolder, input.now), source: "widget" };
  }
  const settingsFolder = cleanFolder(input.settingsFolder);
  if (settingsFolder) {
    return { kind: "path", path: formatDailyPath(format, settingsFolder, input.now), source: "settings" };
  }
  if (input.core) {
    const name = input.formatMoment(input.core.format || "YYYY-MM-DD");
    return { kind: "path", path: join(input.core.folder, `${name}.md`), source: "core" };
  }
  return { kind: "unset" };
}

interface DailyNotesInstance {
  options?: { folder?: unknown; format?: unknown };
}

interface AppWithInternalPlugins {
  internalPlugins?: {
    getEnabledPluginById?: (id: string) => DailyNotesInstance | null | undefined;
  };
}

/** Settings of the core Daily notes plugin, or null when it is off. */
export function readCoreDailyNotes(app: unknown): CoreDailyNotes | null {
  const ip = (app as AppWithInternalPlugins | null)?.internalPlugins;
  const instance = ip?.getEnabledPluginById?.("daily-notes");
  if (!instance) return null;
  const opts = instance.options ?? {};
  return {
    folder: typeof opts.folder === "string" ? opts.folder : "",
    format: typeof opts.format === "string" ? opts.format : "",
  };
}
