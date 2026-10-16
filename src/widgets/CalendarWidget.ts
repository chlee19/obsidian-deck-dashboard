import { Setting } from "obsidian";
import type { WidgetDefinition } from "./types";
import { fetchIcal, parseEventsInRange, type CalEvent } from "../adapters/ical";
import { checkCalendarUrl, resolveCalendarSource } from "../core/icalSource";
import { loadCalendarSources } from "../ui/CalendarSourcesSection";
import { t } from "../core/i18n";

interface Settings {
  /** Name registered in Settings → Deck → Calendars (preferred). */
  source?: string;
  /** Direct URL, kept for older dashboards. Stored inside the .dashboard file. */
  icalUrl: string;
  windowDays: number;
  maxEvents: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { at: number; text: string }>();

async function getIcs(url: string): Promise<string> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.text;
  const text = await fetchIcal(url);
  cache.set(url, { at: Date.now(), text });
  return text;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTimeRange(ev: CalEvent): string {
  if (ev.allDay) return "終日";
  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay =
    ev.start.getFullYear() === ev.end.getFullYear() &&
    ev.start.getMonth() === ev.end.getMonth() &&
    ev.start.getDate() === ev.end.getDate();
  return sameDay ? `${fmt(ev.start)}–${fmt(ev.end)}` : fmt(ev.start);
}

function formatDateHeader(d: Date): string {
  const today = startOfToday();
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round((d.getTime() - today.getTime()) / dayMs);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const label = `${d.getMonth() + 1}/${d.getDate()}（${wd}）`;
  if (diff === 0) return `今日 ${label}`;
  if (diff === 1) return `明日 ${label}`;
  if (diff === -1) return `昨日 ${label}`;
  return label;
}

function groupByDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>();
  for (const ev of events) {
    const k = ev.start.toDateString();
    const list = m.get(k) ?? [];
    list.push(ev);
    m.set(k, list);
  }
  return m;
}

export const calendarWidget: WidgetDefinition<Settings> = {
  type: "calendar",
  label: "Calendar (iCal)",
  description:
    "Google/Outlook/Apple カレンダーの予定を表示。非公開の iCal URL は 設定 → Deck → カレンダー に名前で登録して参照。",
  defaultSettings: () => ({
    source: "",
    icalUrl: "",
    windowDays: 7,
    maxEvents: 30,
  }),
  async render(el, settings, ctx) {
    el.empty();
    el.addClass("nd-widget-calendar");
    const strings = t();
    const resolved = resolveCalendarSource(settings, await loadCalendarSources(ctx.plugin));
    if (resolved.kind === "unknown-name") {
      el.createEl("p", { cls: "nd-empty", text: strings.calendarUnknownName(resolved.name) });
      return;
    }
    if (resolved.kind === "unset") {
      const help = el.createDiv({ cls: "nd-empty" });
      help.createEl("p", { text: "iCal URL が未設定です。" });
      const ol = help.createEl("ol");
      ol.createEl("li", {
        text: "Google カレンダー: 設定 → カレンダー → 該当カレンダー → 「カレンダーの統合」→「カレンダーの非公開URL（iCal形式）」をコピー",
      });
      ol.createEl("li", { text: "設定 → Deck → カレンダー に名前を付けて URL を登録し、⚙ でその名前を指定" });
      return;
    }
    // Received dashboards must not make Obsidian contact arbitrary hosts.
    const check = checkCalendarUrl(resolved.url, ctx.settings.allowPrivateCalendarUrls);
    if (!check.ok) {
      el.createEl("p", { cls: "nd-empty", text: strings.calendarRefused(check.reason) });
      return;
    }

    const status = el.createDiv({ cls: "nd-muted", text: "読み込み中…" });
    try {
      const ics = await getIcs(check.url);
      const start = startOfToday();
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(1, settings.windowDays));
      const events = parseEventsInRange(ics, start, end).slice(0, settings.maxEvents);
      status.remove();

      if (events.length === 0) {
        el.createEl("p", { cls: "nd-empty", text: "予定はありません 🎉" });
        return;
      }

      const groups = groupByDay(events);
      for (const [k, evs] of groups) {
        const day = new Date(k);
        const dayHeader = el.createEl("div", {
          cls: "nd-cal-day",
          text: formatDateHeader(day),
        });
        dayHeader.title = day.toLocaleDateString();
        const ul = el.createEl("ul", { cls: "nd-cal-list" });
        for (const ev of evs) {
          const li = ul.createEl("li", { cls: "nd-cal-event" });
          const t = li.createEl("span", { cls: "nd-cal-time", text: formatTimeRange(ev) });
          if (ev.allDay) t.addClass("nd-cal-allday");
          li.createEl("span", { cls: "nd-cal-summary", text: ev.summary });
          if (ev.location) {
            li.createEl("span", { cls: "nd-cal-location", text: ` @ ${ev.location}` });
          }
        }
      }
    } catch (e) {
      status.remove();
      el.createEl("pre", {
        cls: "nd-error",
        text: `Calendar error: ${(e as Error).message}`,
      });
    }
  },
  renderSettingsForm(container, settings, onChange) {
    const strings = t();
    new Setting(container)
      .setName(strings.calendarWidgetSourceName)
      .setDesc(strings.calendarWidgetSourceDesc)
      .addText((text) =>
        text.setValue(settings.source ?? "").onChange((v) => onChange({ ...settings, source: v.trim() }))
      );
    new Setting(container)
      .setName("iCal URL")
      .setDesc(strings.calendarWidgetUrlDesc)
      .addText((text) => {
        text.setValue(settings.icalUrl);
        text.inputEl.addClass("deck-input-full");
        text.onChange((v) => onChange({ ...settings, icalUrl: v.trim() }));
      });
    new Setting(container)
      .setName("表示日数")
      .setDesc("今日から何日先まで表示するか (1=今日のみ / 7=今週)")
      .addText((t) =>
        t.setValue(String(settings.windowDays)).onChange((v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) onChange({ ...settings, windowDays: n });
        })
      );
    new Setting(container)
      .setName("最大件数")
      .addText((t) =>
        t.setValue(String(settings.maxEvents)).onChange((v) => {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > 0) onChange({ ...settings, maxEvents: n });
        })
      );
  },
};
