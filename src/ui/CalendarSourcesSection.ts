import { Notice, Setting } from "obsidian";
import type { Plugin } from "obsidian";
import { SecretStore } from "../core/secrets";
import { checkCalendarUrl } from "../core/icalSource";
import { t } from "../core/i18n";
import type { SettingsSectionHost } from "./DeckSettingsSection";

export type CalendarSources = Record<string, string>;

export async function loadCalendarSources(plugin: Plugin): Promise<CalendarSources> {
  const v = await new SecretStore(plugin).get<CalendarSources>("ical_sources");
  return v && typeof v === "object" ? v : {};
}

/**
 * Settings → Deck → Calendars: named iCal addresses. The address itself is
 * not shown again after saving (only its host), and lives in secret storage
 * when available.
 */
export async function renderCalendarSources(
  containerEl: HTMLElement,
  plugin: Plugin,
  host: SettingsSectionHost,
  redraw: () => void
): Promise<void> {
  const s = t();
  new Setting(containerEl).setName(s.settingsCalendarsHeading).setDesc(s.settingsCalendarsDesc).setHeading();
  const sources = await loadCalendarSources(plugin);
  const store = new SecretStore(plugin);

  for (const [name, url] of Object.entries(sources)) {
    let hostLabel = "";
    try {
      hostLabel = new URL(url).host;
    } catch {
      hostLabel = "?";
    }
    new Setting(containerEl)
      .setName(name)
      .setDesc(hostLabel)
      .addButton((b) =>
        b
          .setButtonText(s.calendarRemove)
          .setWarning()
          .onClick(async () => {
            const next = { ...(await loadCalendarSources(plugin)) };
            delete next[name];
            await store.set("ical_sources", next);
            redraw();
          })
      );
  }

  let newName = "";
  let newUrl = "";
  new Setting(containerEl)
    .addText((text) => text.setPlaceholder(s.calendarNameLabel).onChange((v) => (newName = v.trim())))
    .addText((text) => {
      text.setPlaceholder(s.calendarUrlLabel).onChange((v) => (newUrl = v.trim()));
      text.inputEl.type = "password";
    })
    .addButton((b) =>
      b
        .setButtonText(s.calendarAdd)
        .setCta()
        .onClick(async () => {
          // Scheme and syntax only; the private-network rule applies on fetch.
          const check = checkCalendarUrl(newUrl, true);
          if (!newName || !check.ok) {
            new Notice(s.calendarNeedsNameAndUrl);
            return;
          }
          const next = { ...(await loadCalendarSources(plugin)), [newName]: newUrl };
          await store.set("ical_sources", next);
          redraw();
        })
    );

  new Setting(containerEl)
    .setName(s.calendarAllowPrivateName)
    .setDesc(s.calendarAllowPrivateDesc)
    .addToggle((tog) =>
      tog.setValue(host.settings.allowPrivateCalendarUrls).onChange(async (v) => {
        host.settings.allowPrivateCalendarUrls = v;
        await host.saveSettings();
      })
    );
}
