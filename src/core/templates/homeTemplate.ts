import { CURRENT_SCHEMA_VERSION } from "../constants";
import type { Dashboard } from "../types";
import { getStrings, type Strings } from "../i18n";

// Stock home layout for new installs (and `reset-home`). Folder-dependent
// widgets leave their folder empty or use {{taskFolder}} / {{meetingFolder}},
// so they follow Settings → Deck and show a setup hint until it is filled in.
function buildStockHomeTemplate(s: Strings): Dashboard {
  const notDone = 'status != "完了"';
  const hasDue = '期限 != null AND 期限 != "なし"';
  return {
    version: CURRENT_SCHEMA_VERSION,
    title: s.homeTitle,
    layout: [
      { i: "today", x: 0, y: 0, w: 4, h: 2 },
      { i: "kpi-overdue", x: 4, y: 1, w: 2, h: 2 },
      { i: "kpi-today", x: 6, y: 2, w: 2, h: 2 },
      { i: "kpi-week", x: 8, y: 3, w: 2, h: 2 },
      { i: "kpi-meetings", x: 10, y: 4, w: 2, h: 2 },
      { i: "ai-search", x: 0, y: 5, w: 12, h: 4 },
      { i: "gantt", x: 0, y: 6, w: 12, h: 6 },
      { i: "kanban", x: 0, y: 7, w: 12, h: 6 },
      { i: "today-cal", x: 0, y: 8, w: 4, h: 7 },
      { i: "tasks-today", x: 6, y: 9, w: 4, h: 7 },
      { i: "tasks-week", x: 0, y: 10, w: 4, h: 7 },
      { i: "tasks-by-pjt", x: 6, y: 11, w: 6, h: 5 },
      { i: "recent-minutes", x: 0, y: 12, w: 6, h: 5 },
      { i: "recent-notes", x: 6, y: 13, w: 6, h: 5 },
      { i: "quick-links", x: 0, y: 16, w: 12, h: 4 },
    ],
    widgets: {
      today: {
        type: "today",
        title: s.tplToday,
        settings: {
          greeting: s.tplGreeting,
          dailyFolder: "",
          dailyFormat: "YYYY-MM-DD",
        },
      },
      "kpi-overdue": {
        type: "counter",
        title: s.tplOverdue,
        settings: {
          query:
            'LIST FROM "{{taskFolder}}"\n' +
            `WHERE ${notDone} AND ${hasDue} AND date(期限) < date(today)`,
          label: s.tplOverdueLabel,
          unit: s.tplUnitTasks,
        },
      },
      "kpi-today": {
        type: "counter",
        title: s.tplDueToday,
        settings: {
          query: 'LIST FROM "{{taskFolder}}"\n' + `WHERE ${notDone} AND 期限 = date(today)`,
          label: s.tplDueTodayLabel,
          unit: s.tplUnitTasks,
        },
      },
      "kpi-week": {
        type: "counter",
        title: s.tplDueWeek,
        settings: {
          query:
            'LIST FROM "{{taskFolder}}"\n' +
            `WHERE ${notDone} AND date(期限) >= date(today) AND date(期限) <= date(today) + dur(7 days)`,
          label: s.tplDueWeekLabel,
          unit: s.tplUnitTasks,
        },
      },
      "kpi-meetings": {
        type: "counter",
        title: s.tplMeetingsWeek,
        settings: {
          query: 'LIST FROM "{{meetingFolder}}" WHERE file.cday >= date(today) - dur(7 days)',
          label: s.tplMeetingsWeekLabel,
          unit: s.tplUnitNotes,
        },
      },
      "ai-search": {
        type: "ai-search",
        title: s.tplAiSearch,
        settings: {
          backend: "claude-code",
          claudeCmd: "claude",
          model: "claude-haiku-4-5-20251001",
          topK: 30,
          excerptChars: 300,
          folders: [],
          excludeFolders: [],
        },
      },
      gantt: {
        type: "gantt",
        title: "Gantt",
        settings: {
          source: "frontmatter",
          markwhenPath: "",
          folder: "",
          deadlineField: "期限",
          startField: "開始",
          durationField: "工数",
          statusField: "status",
          groupByField: "PJT",
          windowDaysBack: 180,
          windowDaysForward: 365,
          rowHeight: 26,
          dayWidth: 24,
          hideCompleted: false,
        },
      },
      kanban: {
        type: "kanban",
        title: s.tplKanban,
        settings: {
          folder: "",
          statusField: "status",
          columns: ["未着手", "作業中", "AI移譲", "レビュー待ち", "完了"],
          showFields: ["PJT", "期限", "優先度"],
          hideCompleted: false,
        },
      },
      "today-cal": {
        type: "gcal",
        title: s.tplCalendar,
        settings: {
          calendarId: "primary",
          windowDays: 7,
          maxEvents: 40,
        },
      },
      "tasks-today": {
        type: "dataview",
        title: s.tplTasksToday,
        settings: {
          mode: "dql",
          query:
            `TABLE PJT, 期限 AS "${s.tplColumnDue}", 優先度 AS "${s.tplColumnPriority}", status AS "${s.tplColumnStatus}"\n` +
            'FROM "{{taskFolder}}"\n' +
            `WHERE ${notDone} AND ${hasDue} AND date(期限) <= date(today)\n` +
            "SORT date(期限) ASC\n" +
            "LIMIT 6",
        },
      },
      "tasks-week": {
        type: "dataview",
        title: s.tplTasksWeek,
        settings: {
          mode: "dql",
          query:
            `TABLE PJT, 期限 AS "${s.tplColumnDue}", 優先度 AS "${s.tplColumnPriority}"\n` +
            'FROM "{{taskFolder}}"\n' +
            `WHERE ${notDone} AND ${hasDue}\n` +
            "  AND date(期限) > date(today) AND date(期限) <= date(today) + dur(7 days)\n" +
            "SORT date(期限) ASC",
        },
      },
      "tasks-by-pjt": {
        type: "dataview",
        title: s.tplTasksByProject,
        settings: {
          mode: "dql",
          query:
            `TABLE length(rows) AS "${s.tplColumnCount}"\n` +
            'FROM "{{taskFolder}}"\n' +
            `WHERE ${notDone}\n` +
            "GROUP BY PJT\n" +
            "SORT length(rows) DESC",
        },
      },
      "recent-minutes": {
        type: "dataview",
        title: s.tplRecentMeetings,
        settings: {
          mode: "dql",
          query:
            `TABLE file.mtime AS "${s.tplColumnUpdated}"\n` +
            'FROM "{{meetingFolder}}"\n' +
            "SORT file.mtime DESC\n" +
            "LIMIT 10",
        },
      },
      // Needs no folder at all, so the home dashboard shows something from
      // the user's own vault right after install.
      "recent-notes": {
        type: "dataview",
        title: s.tplRecentNotes,
        settings: {
          mode: "dql",
          query: `TABLE file.mtime AS "${s.tplColumnUpdated}"\n` + "SORT file.mtime DESC\n" + "LIMIT 10",
        },
      },
      "quick-links": {
        type: "markdown",
        title: s.tplGuideTitle,
        settings: {
          content: s.tplGuideBody,
        },
      },
    },
  };
}

let templateOverride: Dashboard | null = null;

// Replace the home template at runtime (e.g. user-defined templates loaded
// from settings or an external JSON). Pass `null` to fall back to the stock
// template bundled with the plugin.
export function setHomeTemplate(template: Dashboard | null): void {
  templateOverride = template;
}

// Returns a deep copy of the active home template so callers can freely mutate
// the result (e.g. rename the title) without corrupting the shared template.
// `strings` picks the language of titles and labels (English by default).
export function getHomeTemplate(title?: string, strings: Strings = getStrings("en")): Dashboard {
  const source = templateOverride ?? buildStockHomeTemplate(strings);
  const clone = cloneDashboard(source);
  if (title !== undefined) clone.title = title;
  return clone;
}

export function getStockHomeTemplate(strings: Strings = getStrings("en")): Dashboard {
  return cloneDashboard(buildStockHomeTemplate(strings));
}

function cloneDashboard(d: Dashboard): Dashboard {
  // Templates are pure JSON, so structured cloning via JSON round-trip is
  // sufficient and avoids leaking references between consumers.
  return JSON.parse(JSON.stringify(d)) as Dashboard;
}
