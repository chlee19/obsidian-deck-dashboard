import { describe, expect, it } from "vitest";
import {
  DEFAULT_HOME_PATH,
  FRESH_SETTINGS,
  LEGACY_HOME_PATH,
  LEGACY_SETTINGS,
  SETTINGS_KEY,
  cleanFolder,
  dashboardFolderPath,
  effectiveFolder,
  homeDashboardPath,
  migratePluginData,
  searchExcludes,
  settingsOf,
} from "../src/core/settings";

const noLegacyHome = { legacyHomeExists: false };

describe("migratePluginData", () => {
  it("starts a fresh install (no data.json) with every folder unset", () => {
    const r = migratePluginData(null, noLegacyHome);
    expect(r.legacy).toBe(false);
    expect(r.settings).toEqual(FRESH_SETTINGS);
    expect(r.settings.taskFolder).toBe("");
    expect(r.settings.dailyNotesFolder).toBe("");
    expect(r.settings.openHomeOnStartup).toBe(false);
    expect(r.changed).toBe(true);
    expect(r.data[SETTINGS_KEY]).toEqual(FRESH_SETTINGS);
  });

  it("keeps the old hard-coded folders for users upgrading with a data.json", () => {
    const r = migratePluginData({ google_tokens: { access_token: "fake" } }, noLegacyHome);
    expect(r.legacy).toBe(true);
    expect(r.settings).toEqual(LEGACY_SETTINGS);
    expect(r.settings.taskFolder).toBe("タスク/詳細");
    expect(r.settings.homeDashboard).toBe(LEGACY_HOME_PATH);
    expect(r.changed).toBe(true);
    // other keys are left untouched
    expect(r.data.google_tokens).toEqual({ access_token: "fake" });
  });

  it("treats a vault that already has the old home dashboard as an upgrade", () => {
    const r = migratePluginData(null, { legacyHomeExists: true });
    expect(r.legacy).toBe(true);
    expect(r.settings.taskFolder).toBe(LEGACY_SETTINGS.taskFolder);
  });

  it("keeps the old mail RAG folders only for upgrading users who never saved them", () => {
    const upgraded = migratePluginData({ auto_sync: false }, noLegacyHome);
    expect((upgraded.data.mail_config as { ragFolders: string[] }).ragFolders).toEqual(["議事録", "ナレッジ"]);

    const saved = migratePluginData({ mail_config: { ragFolders: ["Clients"] } }, noLegacyHome);
    expect((saved.data.mail_config as { ragFolders: string[] }).ragFolders).toEqual(["Clients"]);

    const fresh = migratePluginData(null, noLegacyHome);
    expect(fresh.data.mail_config).toBeUndefined();
  });

  it("uses stored values and only fills missing fields with fresh defaults", () => {
    const r = migratePluginData(
      { [SETTINGS_KEY]: { taskFolder: "Work/Tasks/", openHomeOnStartup: true } },
      noLegacyHome
    );
    expect(r.legacy).toBe(false);
    expect(r.settings.taskFolder).toBe("Work/Tasks");
    expect(r.settings.openHomeOnStartup).toBe(true);
    expect(r.settings.dailyNotesFolder).toBe("");
    expect(r.changed).toBe(true);
  });

  it("reports no change once everything is stored", () => {
    const first = migratePluginData(null, noLegacyHome);
    const second = migratePluginData(first.data, noLegacyHome);
    expect(second.changed).toBe(false);
    expect(second.settings).toEqual(first.settings);
  });

  it("ignores values of the wrong type", () => {
    const r = migratePluginData(
      { [SETTINGS_KEY]: { taskFolder: 42, searchExcludeFolders: "Archive", openHomeOnStartup: "yes" } },
      noLegacyHome
    );
    expect(r.settings.taskFolder).toBe("");
    expect(r.settings.searchExcludeFolders).toEqual([]);
    expect(r.settings.openHomeOnStartup).toBe(false);
  });

  it("does not mutate the input object", () => {
    const input = { auto_sync: true };
    migratePluginData(input, noLegacyHome);
    expect(input).toEqual({ auto_sync: true });
  });
});

describe("claudeCommand setting", () => {
  it("defaults to claude for new and upgrading users", () => {
    expect(migratePluginData(null, noLegacyHome).settings.claudeCommand).toBe("claude");
    expect(migratePluginData({ auto_sync: true }, noLegacyHome).settings.claudeCommand).toBe("claude");
  });

  it("carries over the command an upgrading user had saved for mail", () => {
    const r = migratePluginData({ mail_config: { claudeCmd: "/opt/tools/claude" } }, noLegacyHome);
    expect(r.settings.claudeCommand).toBe("/opt/tools/claude");
  });

  it("keeps a stored value and ignores values of the wrong type", () => {
    expect(
      migratePluginData({ [SETTINGS_KEY]: { claudeCommand: "/usr/local/bin/claude" } }, noLegacyHome).settings
        .claudeCommand
    ).toBe("/usr/local/bin/claude");
    expect(
      migratePluginData({ [SETTINGS_KEY]: { claudeCommand: 7 } }, noLegacyHome).settings.claudeCommand
    ).toBe("claude");
  });
});

describe("cleanFolder", () => {
  it("trims spaces and slashes", () => {
    expect(cleanFolder("  /Tasks/Open/ ")).toBe("Tasks/Open");
    expect(cleanFolder("a//b")).toBe("a/b");
    expect(cleanFolder("/")).toBe("");
    expect(cleanFolder(undefined)).toBe("");
  });
});

describe("effectiveFolder", () => {
  it("prefers the folder written in the widget", () => {
    expect(effectiveFolder("Projects", "Tasks")).toBe("Projects");
  });
  it("falls back to the plugin setting when the widget leaves it empty", () => {
    expect(effectiveFolder("", "Tasks")).toBe("Tasks");
    expect(effectiveFolder(undefined, "Tasks/")).toBe("Tasks");
  });
  it("returns empty when neither is set", () => {
    expect(effectiveFolder("", "")).toBe("");
  });
});

describe("homeDashboardPath", () => {
  it("uses the configured file", () => {
    expect(homeDashboardPath({ ...FRESH_SETTINGS, homeDashboard: "Boards/Main.dashboard" })).toBe(
      "Boards/Main.dashboard"
    );
  });
  it("adds the .dashboard extension when missing", () => {
    expect(homeDashboardPath({ ...FRESH_SETTINGS, homeDashboard: "Boards/Main" })).toBe(
      "Boards/Main.dashboard"
    );
  });
  it("falls back to a file at the vault root", () => {
    expect(homeDashboardPath({ ...FRESH_SETTINGS, homeDashboard: "  " })).toBe(DEFAULT_HOME_PATH);
  });
});

describe("dashboardFolderPath", () => {
  it("is the vault root when empty", () => {
    expect(dashboardFolderPath(FRESH_SETTINGS)).toBe("");
    expect(dashboardFolderPath({ ...FRESH_SETTINGS, dashboardFolder: "Boards/" })).toBe("Boards");
  });
});

describe("searchExcludes", () => {
  it("adds the widget list and the plugin's own log folders to the global list", () => {
    const s = { ...FRESH_SETTINGS, searchExcludeFolders: ["Archive"], aiLogFolder: "Logs/AI", syncLogFolder: "" };
    expect(searchExcludes(s, ["Private", "Archive"])).toEqual(["Archive", "Logs/AI", "Private"]);
  });
});

describe("settingsOf", () => {
  it("reads the settings a plugin host exposes", () => {
    const s = { ...FRESH_SETTINGS, taskFolder: "Tasks" };
    expect(settingsOf({ settings: s }).taskFolder).toBe("Tasks");
  });
  it("falls back to fresh defaults for anything else", () => {
    expect(settingsOf({})).toEqual(FRESH_SETTINGS);
    expect(settingsOf(null)).toEqual(FRESH_SETTINGS);
  });
});
