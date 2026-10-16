import { describe, expect, it } from "vitest";
import { registerBuiltinWidgets, widgetRegistry } from "../src/widgets";
import { getHomeTemplate } from "../src/core/templates/homeTemplate";
import { LEGACY_SETTINGS } from "../src/core/settings";

// Folders that 0.0.x had hard-coded. They may only live in LEGACY_SETTINGS
// (for upgrading users), never in what a new widget or the template writes.
const legacyFolders = [
  LEGACY_SETTINGS.taskFolder,
  LEGACY_SETTINGS.dailyNotesFolder,
  LEGACY_SETTINGS.meetingNotesFolder,
  LEGACY_SETTINGS.markwhenFile,
  LEGACY_SETTINGS.aiNotesFolder,
  ...LEGACY_SETTINGS.searchExcludeFolders,
];

describe("widget defaults", () => {
  registerBuiltinWidgets();

  it("do not point new widgets at folders from one particular vault", () => {
    for (const def of widgetRegistry.all()) {
      const json = JSON.stringify(def.defaultSettings());
      for (const folder of legacyFolders) {
        expect(json, `${def.type} default mentions "${folder}"`).not.toContain(`"${folder}`);
      }
    }
  });
});

describe("home template folders", () => {
  it("reads tasks and meeting notes through tokens, not literal folders", () => {
    const json = JSON.stringify(getHomeTemplate());
    for (const folder of legacyFolders) {
      expect(json, `template mentions "${folder}"`).not.toContain(`\\"${folder}`);
      expect(json, `template mentions "${folder}"`).not.toContain(`"${folder}"`);
    }
    expect(json).toContain("{{taskFolder}}");
    expect(json).toContain("{{meetingFolder}}");
  });

  it("leaves widget folders empty so they follow the plugin settings", () => {
    const tpl = getHomeTemplate();
    for (const [id, w] of Object.entries(tpl.widgets)) {
      const s = w.settings as Record<string, unknown>;
      for (const key of ["folder", "dailyFolder", "markwhenPath"]) {
        if (key in s) expect(s[key], `${id}.${key}`).toBe("");
      }
    }
  });
});
