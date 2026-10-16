import { moment } from "obsidian";

// UI strings added in 0.1.0 and later. English is the default; Japanese is
// picked when Obsidian runs in a ja locale. Older UI text that is still
// hard-coded in Japanese is migrated here gradually.
export interface Strings {
  openSettings: string;
  folderNotSet: (label: string) => string;
  fileNotSet: (label: string) => string;
  setFirstNotice: (label: string) => string;
  inheritFolderHint: string;
  notSetPlaceholder: string;

  settingsHomeHeading: string;
  settingsHomeFileName: string;
  settingsHomeFileDesc: string;
  settingsOpenOnStartupName: string;
  settingsOpenOnStartupDesc: string;
  settingsDashboardFolderName: string;
  settingsDashboardFolderDesc: string;
  settingsFoldersHeading: string;
  settingsFoldersIntro: string;
  taskFolderName: string;
  taskFolderDesc: string;
  dailyFolderName: string;
  dailyFolderDesc: string;
  meetingFolderName: string;
  meetingFolderDesc: string;
  markwhenFileName: string;
  markwhenFileDesc: string;
  aiLogFolderName: string;
  aiLogFolderDesc: string;
  syncLogFolderName: string;
  syncLogFolderDesc: string;
  aiNotesFolderName: string;
  aiNotesFolderDesc: string;
  excludeFoldersName: string;
  excludeFoldersDesc: string;

  basesLabel: string;
  basesDescription: string;
  basesFileName: string;
  basesFileDesc: string;
  basesViewName: string;
  basesViewDesc: string;
  basesUnavailable: string;
  basesFileMissing: (path: string) => string;

  homeTitle: string;
  tplToday: string;
  tplGreeting: string;
  tplOverdue: string;
  tplOverdueLabel: string;
  tplDueToday: string;
  tplDueTodayLabel: string;
  tplDueWeek: string;
  tplDueWeekLabel: string;
  tplMeetingsWeek: string;
  tplMeetingsWeekLabel: string;
  tplUnitTasks: string;
  tplUnitNotes: string;
  tplAiSearch: string;
  tplKanban: string;
  tplCalendar: string;
  tplTasksToday: string;
  tplTasksWeek: string;
  tplTasksByProject: string;
  tplRecentMeetings: string;
  tplRecentNotes: string;
  tplColumnDue: string;
  tplColumnPriority: string;
  tplColumnStatus: string;
  tplColumnCount: string;
  tplColumnUpdated: string;
  tplGuideTitle: string;
  tplGuideBody: string;
}

const en: Strings = {
  openSettings: "Open settings",
  folderNotSet: (label) => `Set the “${label}” folder to show this widget.`,
  fileNotSet: (label) => `Set the “${label}” file to show this widget.`,
  setFirstNotice: (label) => `Set “${label}” in Settings → Deck first.`,
  inheritFolderHint: "Leave empty to use the folder from Settings → Deck.",
  notSetPlaceholder: "Not set",

  settingsHomeHeading: "Home dashboard",
  settingsHomeFileName: "Home dashboard file",
  settingsHomeFileDesc:
    "Opened by the “Open home dashboard” command and the ribbon icon. It is created from the template when it does not exist yet.",
  settingsOpenOnStartupName: "Open the home dashboard on startup",
  settingsOpenOnStartupDesc:
    "When Obsidian has finished loading, open the home dashboard. If it is already open, switch to that tab.",
  settingsDashboardFolderName: "Folder for new dashboards",
  settingsDashboardFolderDesc: "Used by “Create new dashboard”. Leave empty to create them at the vault root.",
  settingsFoldersHeading: "Folders",
  settingsFoldersIntro:
    "Widgets read your notes from these folders. A widget whose folder is not set shows a reminder with a button back to this page. Folders written inside an existing .dashboard file are kept as they are.",
  taskFolderName: "Task notes",
  taskFolderDesc:
    "Notes with a status field in their frontmatter. Used by Kanban, Gantt, Charts, Task creator, Sheets sync and the {{taskFolder}} token in Dataview queries.",
  dailyFolderName: "Daily notes",
  dailyFolderDesc:
    "Used by the Today widget. When empty, the folder and date format of the core Daily notes plugin are used if it is turned on.",
  meetingFolderName: "Meeting notes",
  meetingFolderDesc: "Used by the {{meetingFolder}} token in Dataview queries, such as the home dashboard's meeting widgets.",
  markwhenFileName: "Markwhen file",
  markwhenFileDesc: "A .mw file. Used by the Gantt widget when its source is Markwhen.",
  aiLogFolderName: "AI delegation logs",
  aiLogFolderDesc:
    "Each run of “delegate to Claude Code” is written here as a note. Required before a task can be delegated.",
  syncLogFolderName: "Sheets sync logs",
  syncLogFolderDesc: "One JSON line per sync is appended to a daily .jsonl file here. Leave empty to keep no log.",
  aiNotesFolderName: "Notes saved from AI search",
  aiNotesFolderDesc: "Where the “save as note” button of the AI search widget creates notes.",
  excludeFoldersName: "Folders excluded from AI search",
  excludeFoldersDesc:
    "Comma separated. Skipped by AI search and AI mail replies, in addition to each widget's own list. The log folders above are always skipped.",

  basesLabel: "Base (.base)",
  basesDescription: "Shows a .base file (Obsidian Bases) inside the dashboard.",
  basesFileName: "Base file",
  basesFileDesc: "Path to a .base file in this vault.",
  basesViewName: "View (optional)",
  basesViewDesc: "Name of a view inside the base. Leave empty to show the first view.",
  basesUnavailable:
    "Bases is not available here. It needs Obsidian 1.9 or later with the Bases core plugin turned on (Settings → Core plugins).",
  basesFileMissing: (path) => `File not found: ${path}`,

  homeTitle: "Home",
  tplToday: "Today",
  tplGreeting: "Good morning ☀️",
  tplOverdue: "Overdue",
  tplOverdueLabel: "🔥 Overdue",
  tplDueToday: "Due today",
  tplDueTodayLabel: "📌 Due today",
  tplDueWeek: "Due this week",
  tplDueWeekLabel: "📅 Due in 7 days",
  tplMeetingsWeek: "Meetings this week",
  tplMeetingsWeekLabel: "💬 Meeting notes (7 days)",
  tplUnitTasks: "tasks",
  tplUnitNotes: "notes",
  tplAiSearch: "AI search",
  tplKanban: "Kanban",
  tplCalendar: "This week",
  tplTasksToday: "🔥 Due today and overdue",
  tplTasksWeek: "📅 Due in the next 7 days",
  tplTasksByProject: "📊 Open tasks by project",
  tplRecentMeetings: "💬 Recent meeting notes",
  tplRecentNotes: "🕘 Recently edited notes",
  tplColumnDue: "Due",
  tplColumnPriority: "Priority",
  tplColumnStatus: "Status",
  tplColumnCount: "Count",
  tplColumnUpdated: "Updated",
  tplGuideTitle: "🧭 Getting started",
  tplGuideBody:
    "## Make it yours\n" +
    "- Set your folders in **Settings → Deck** (tasks, daily notes, meeting notes). Widgets that need one show a button that takes you there.\n" +
    "- Most list and counter widgets use the **Dataview** plugin. Calendar and mail need Google sign-in.\n\n" +
    "## Editing\n" +
    "- ⚙ edits a widget (changes are saved as you type)\n" +
    "- ✎ switches to edit mode: drag to reorder, change width and height\n" +
    "- ↻ reloads the dashboard\n" +
    "- Click the title to rename this dashboard\n\n" +
    "_Feel free to rewrite this note._",
};

const ja: Strings = {
  openSettings: "設定を開く",
  folderNotSet: (label) => `このウィジェットを表示するには「${label}」のフォルダを設定してください。`,
  fileNotSet: (label) => `このウィジェットを表示するには「${label}」のファイルを設定してください。`,
  setFirstNotice: (label) => `先に 設定 → Deck で「${label}」を設定してください。`,
  inheritFolderHint: "空なら 設定 → Deck のフォルダを使います。",
  notSetPlaceholder: "未設定",

  settingsHomeHeading: "ホームダッシュボード",
  settingsHomeFileName: "ホームダッシュボードのファイル",
  settingsHomeFileDesc:
    "「Open home dashboard」コマンドとリボンのアイコンで開くファイルです。まだ無いときはテンプレートから作ります。",
  settingsOpenOnStartupName: "起動時にホームダッシュボードを開く",
  settingsOpenOnStartupDesc:
    "Obsidian の読み込みが終わったらホームダッシュボードを開きます。すでに開いているときは、そのタブに切り替えます。",
  settingsDashboardFolderName: "新しいダッシュボードの保存先",
  settingsDashboardFolderDesc: "「Create new dashboard」で作るファイルの置き場所です。空なら vault の直下に作ります。",
  settingsFoldersHeading: "フォルダ",
  settingsFoldersIntro:
    "ウィジェットはここで指定したフォルダからノートを読みます。フォルダが未設定のウィジェットには、この画面に戻るボタン付きの案内を出します。既存の .dashboard ファイルに書かれたフォルダは、そのまま使います。",
  taskFolderName: "タスクのノート",
  taskFolderDesc:
    "frontmatter に status を持つノートの置き場所です。Kanban・Gantt・Charts・Task creator・Sheets 同期と、Dataview クエリの {{taskFolder}} で使います。",
  dailyFolderName: "デイリーノート",
  dailyFolderDesc:
    "Today ウィジェットで使います。空のときは、コアプラグイン「デイリーノート」が有効ならそのフォルダと日付形式を使います。",
  meetingFolderName: "議事録",
  meetingFolderDesc: "Dataview クエリの {{meetingFolder}} で使います。ホームダッシュボードの議事録ウィジェットもこれを参照します。",
  markwhenFileName: "Markwhen ファイル",
  markwhenFileDesc: ".mw ファイルです。Gantt ウィジェットのソースを Markwhen にしたときに読みます。",
  aiLogFolderName: "AI 移譲のログ",
  aiLogFolderDesc:
    "Claude Code へのタスク移譲を 1 回ごとにノートとして書き出す場所です。移譲を使う前に設定が必要です。",
  syncLogFolderName: "Sheets 同期のログ",
  syncLogFolderDesc: "同期のたびに 1 行の JSON を日付ごとの .jsonl に追記します。空ならログを残しません。",
  aiNotesFolderName: "AI 検索から保存するノート",
  aiNotesFolderDesc: "AI 検索ウィジェットの「ノートとして保存」ボタンでノートを作る場所です。",
  excludeFoldersName: "AI 検索から除くフォルダ",
  excludeFoldersDesc:
    "カンマ区切りで指定します。AI 検索と AI のメール返信で、各ウィジェットの除外リストに加えて読み飛ばします。上のログ用フォルダは常に除きます。",

  basesLabel: "Base (.base)",
  basesDescription: ".base ファイル（Obsidian Bases）をダッシュボードの中に表示します。",
  basesFileName: "Base ファイル",
  basesFileDesc: "この vault にある .base ファイルのパスです。",
  basesViewName: "ビュー（任意）",
  basesViewDesc: "base の中のビュー名です。空なら最初のビューを表示します。",
  basesUnavailable:
    "この環境では Bases を使えません。Obsidian 1.9 以降で、コアプラグイン「Bases」を有効にしてください（設定 → コアプラグイン）。",
  basesFileMissing: (path) => `ファイルが見つかりません: ${path}`,

  homeTitle: "ホーム",
  tplToday: "今日",
  tplGreeting: "おはよう ☀️",
  tplOverdue: "期限超過",
  tplOverdueLabel: "🔥 期限超過",
  tplDueToday: "今日締切",
  tplDueTodayLabel: "📌 今日締切",
  tplDueWeek: "今週締切",
  tplDueWeekLabel: "📅 7日以内に締切",
  tplMeetingsWeek: "今週の議事録",
  tplMeetingsWeekLabel: "💬 7日以内の議事録",
  tplUnitTasks: "件",
  tplUnitNotes: "件",
  tplAiSearch: "AI 検索",
  tplKanban: "Kanban",
  tplCalendar: "今週の予定",
  tplTasksToday: "🔥 今日締切と期限超過",
  tplTasksWeek: "📅 7日以内に締切",
  tplTasksByProject: "📊 PJT別の未完了タスク",
  tplRecentMeetings: "💬 最近の議事録",
  tplRecentNotes: "🕘 最近編集したノート",
  tplColumnDue: "期限",
  tplColumnPriority: "優先",
  tplColumnStatus: "状態",
  tplColumnCount: "件数",
  tplColumnUpdated: "更新",
  tplGuideTitle: "🧭 はじめに",
  tplGuideBody:
    "## 自分の vault に合わせる\n" +
    "- **設定 → Deck** でフォルダ（タスク・デイリーノート・議事録）を指定します。フォルダが必要なウィジェットには、設定画面へのボタンが出ます。\n" +
    "- 一覧やカウンターのウィジェットの多くは **Dataview** プラグインを使います。カレンダーとメールには Google へのサインインが必要です。\n\n" +
    "## 編集のしかた\n" +
    "- ⚙ でウィジェットを編集（入力はその場で保存）\n" +
    "- ✎ で編集モード（ドラッグで並び替え、幅と高さの変更）\n" +
    "- ↻ でダッシュボードを読み込み直す\n" +
    "- タイトルをクリックすると名前を変えられます\n\n" +
    "_このメモは自由に書き換えてかまいません。_",
};

export function getStrings(locale: string): Strings {
  return locale.toLowerCase().startsWith("ja") ? ja : en;
}

/** Strings for the locale Obsidian is currently running in. */
export function t(): Strings {
  return getStrings(moment.locale());
}
