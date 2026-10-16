import { Setting } from "obsidian";
import type { App } from "obsidian";
import type { DeckHost, DeckSettings } from "../core/settings";
import { cleanFolder } from "../core/settings";
import { t, type Strings } from "../core/i18n";
import { PathSuggest, type PathKind } from "./PathSuggest";
import { DEFAULT_CLAUDE_COMMAND, isExecutableFile, validateClaudeCommand } from "../core/claudeCommand";

/** What the settings section needs from the plugin. */
export interface SettingsSectionHost extends DeckHost {
  saveSettings(): Promise<void>;
}

type FolderKey = Exclude<
  {
    [K in keyof DeckSettings]: DeckSettings[K] extends string ? K : never;
  }[keyof DeckSettings],
  "claudeCommand"
>;

interface PathRow {
  key: FolderKey;
  name: keyof Strings;
  desc: keyof Strings;
  kind: PathKind;
}

const FOLDER_ROWS: PathRow[] = [
  { key: "taskFolder", name: "taskFolderName", desc: "taskFolderDesc", kind: { folders: true } },
  { key: "dailyNotesFolder", name: "dailyFolderName", desc: "dailyFolderDesc", kind: { folders: true } },
  { key: "meetingNotesFolder", name: "meetingFolderName", desc: "meetingFolderDesc", kind: { folders: true } },
  { key: "markwhenFile", name: "markwhenFileName", desc: "markwhenFileDesc", kind: { extensions: ["mw"] } },
  { key: "aiLogFolder", name: "aiLogFolderName", desc: "aiLogFolderDesc", kind: { folders: true } },
  { key: "syncLogFolder", name: "syncLogFolderName", desc: "syncLogFolderDesc", kind: { folders: true } },
  { key: "aiNotesFolder", name: "aiNotesFolderName", desc: "aiNotesFolderDesc", kind: { folders: true } },
];

/**
 * Top of Settings → Deck: the home dashboard and every folder widgets read.
 * Comes first so a new user sees what to set before the Google sections.
 */
export function renderDeckSettings(containerEl: HTMLElement, app: App, host: SettingsSectionHost): void {
  const s = t();
  const settings = host.settings;

  new Setting(containerEl).setName(s.settingsHomeHeading).setHeading();

  new Setting(containerEl)
    .setName(s.settingsHomeFileName)
    .setDesc(s.settingsHomeFileDesc)
    .addText((text) => {
      text.setPlaceholder("Home.dashboard").setValue(settings.homeDashboard);
      new PathSuggest(app, text.inputEl, { extensions: ["dashboard"] });
      text.onChange(async (v) => {
        settings.homeDashboard = v.trim();
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName(s.settingsOpenOnStartupName)
    .setDesc(s.settingsOpenOnStartupDesc)
    .addToggle((tog) =>
      tog.setValue(settings.openHomeOnStartup).onChange(async (v) => {
        settings.openHomeOnStartup = v;
        await host.saveSettings();
      })
    );

  addPathSetting(containerEl, app, host, {
    key: "dashboardFolder",
    name: "settingsDashboardFolderName",
    desc: "settingsDashboardFolderDesc",
    kind: { folders: true },
  });

  new Setting(containerEl).setName(s.settingsFoldersHeading).setDesc(s.settingsFoldersIntro).setHeading();
  for (const row of FOLDER_ROWS) addPathSetting(containerEl, app, host, row);

  new Setting(containerEl)
    .setName(s.excludeFoldersName)
    .setDesc(s.excludeFoldersDesc)
    .addText((text) => {
      text.setValue(settings.searchExcludeFolders.join(", "));
      text.inputEl.addClass("deck-input-full");
      text.onChange(async (v) => {
        settings.searchExcludeFolders = v
          .split(",")
          .map((x) => cleanFolder(x))
          .filter(Boolean);
        await host.saveSettings();
      });
    });

  renderClaudeCommandSetting(containerEl, host);
}

/**
 * The only place the Claude Code command can be set. Dashboard files cannot
 * override it; the value is checked here as it is typed and again before
 * every run.
 */
function renderClaudeCommandSetting(containerEl: HTMLElement, host: SettingsSectionHost): void {
  const s = t();
  new Setting(containerEl).setName(s.settingsAiHeading).setHeading();
  const setting = new Setting(containerEl).setName(s.claudeCommandName).setDesc(s.claudeCommandDesc);
  const status = setting.descEl.createDiv({ cls: "mod-warning" });
  const showStatus = (value: string): void => {
    const check = validateClaudeCommand(value.trim() || DEFAULT_CLAUDE_COMMAND, isExecutableFile);
    status.setText(check.ok ? "" : s.claudeCommandRejected(check.reason));
  };
  setting.addText((text) => {
    text.setPlaceholder(DEFAULT_CLAUDE_COMMAND).setValue(host.settings.claudeCommand);
    showStatus(host.settings.claudeCommand);
    text.onChange(async (v) => {
      host.settings.claudeCommand = v.trim();
      showStatus(v);
      await host.saveSettings();
    });
  });
}

function addPathSetting(containerEl: HTMLElement, app: App, host: SettingsSectionHost, row: PathRow): void {
  const s = t();
  new Setting(containerEl)
    .setName(s[row.name] as string)
    .setDesc(s[row.desc] as string)
    .addText((text) => {
      text.setPlaceholder(s.notSetPlaceholder).setValue(host.settings[row.key]);
      new PathSuggest(app, text.inputEl, row.kind);
      text.onChange(async (v) => {
        host.settings[row.key] = cleanFolder(v);
        await host.saveSettings();
      });
    });
}
