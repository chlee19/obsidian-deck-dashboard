import { describe, expect, it } from "vitest";
import { formatDailyPath, readCoreDailyNotes, resolveDailyNote } from "../src/core/dailyNote";

const now = new Date(2026, 9, 16); // 2026-10-16
const fmt = (f: string) => f.replace(/YYYY/g, "2026").replace(/MM/g, "10").replace(/DD/g, "16");

describe("formatDailyPath", () => {
  it("builds the three supported layouts", () => {
    expect(formatDailyPath("YYYY-MM-DD", "Daily", now)).toBe("Daily/2026-10-16.md");
    expect(formatDailyPath("YYYY/MM/DD", "Daily/", now)).toBe("Daily/2026/10/2026-10-16.md");
    expect(formatDailyPath("YYYY/YYYY-MM-DD", "Daily", now)).toBe("Daily/2026/2026-10-16.md");
  });
});

describe("resolveDailyNote", () => {
  const base = { settingsFolder: "", core: null, now, formatMoment: fmt };

  it("uses the folder written in the widget first (existing dashboards)", () => {
    const r = resolveDailyNote({ ...base, widgetFolder: "Journal", widgetFormat: "YYYY/YYYY-MM-DD", settingsFolder: "Daily" });
    expect(r).toEqual({ kind: "path", path: "Journal/2026/2026-10-16.md", source: "widget" });
  });

  it("then the plugin setting", () => {
    const r = resolveDailyNote({ ...base, widgetFolder: "", widgetFormat: "YYYY-MM-DD", settingsFolder: "Daily" });
    expect(r).toEqual({ kind: "path", path: "Daily/2026-10-16.md", source: "settings" });
  });

  it("then the core Daily notes plugin, with its own date format", () => {
    const r = resolveDailyNote({ ...base, widgetFolder: "", core: { folder: "Journal/", format: "YYYY/MM/YYYY-MM-DD" } });
    expect(r).toEqual({ kind: "path", path: "Journal/2026/10/2026-10-16.md", source: "core" });
  });

  it("puts core daily notes at the vault root when the core plugin has no folder", () => {
    const r = resolveDailyNote({ ...base, core: { folder: "", format: "" } });
    expect(r).toEqual({ kind: "path", path: "2026-10-16.md", source: "core" });
  });

  it("reports unset when nothing is configured", () => {
    expect(resolveDailyNote(base)).toEqual({ kind: "unset" });
  });
});

describe("readCoreDailyNotes", () => {
  it("returns null when the core plugin is off or the API is missing", () => {
    expect(readCoreDailyNotes({})).toBeNull();
    expect(readCoreDailyNotes({ internalPlugins: { getEnabledPluginById: () => null } })).toBeNull();
  });

  it("reads folder and format from the enabled core plugin", () => {
    const app = {
      internalPlugins: {
        getEnabledPluginById: (id: string) =>
          id === "daily-notes" ? { options: { folder: "Journal", format: "YYYY-MM-DD" } } : null,
      },
    };
    expect(readCoreDailyNotes(app)).toEqual({ folder: "Journal", format: "YYYY-MM-DD" });
  });

  it("tolerates missing options", () => {
    const app = { internalPlugins: { getEnabledPluginById: () => ({}) } };
    expect(readCoreDailyNotes(app)).toEqual({ folder: "", format: "" });
  });
});
