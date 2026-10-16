import { Plugin, debounce } from "obsidian";
import type { App } from "obsidian";
import { DashboardView } from "./core/DashboardView";
import { MailView } from "./core/MailView";
import {
  DASHBOARD_EXTENSION,
  VIEW_TYPE_DASHBOARD,
  VIEW_TYPE_MAIL,
} from "./core/constants";
import { registerCommands } from "./commands";
import { registerBuiltinWidgets } from "./widgets";
import { getAISessionRegistry } from "./core/AISessionRegistry";
import { AISessionListModal } from "./ui/AISessionListModal";
import { AutoSyncWatcher } from "./sync/autoSyncWatcher";
import { SyncSettingsTab } from "./ui/SyncSettingsTab";
import {
  FRESH_SETTINGS,
  LEGACY_HOME_PATH,
  SETTINGS_KEY,
  migratePluginData,
  type DeckHost,
  type DeckSettings,
} from "./core/settings";

/** Minimal shape of Obsidian's (untyped) internal command registry. */
interface CommandRegistry {
  executeCommandById(id: string): boolean;
}
/** Obsidian's `App` augmented with the internal command registry. */
type AppWithCommands = App & { commands: CommandRegistry };

/** Obsidian's (untyped) settings modal. */
interface SettingModal {
  open(): void;
  openTabById(id: string): unknown;
}
type AppWithSetting = App & { setting?: SettingModal };

/** Desktop vault adapter exposes the absolute base path (not in public typings). */
interface BasePathAdapter {
  getBasePath?: () => string;
}

export default class DeckPlugin extends Plugin implements DeckHost {
  settings: DeckSettings = { ...FRESH_SETTINGS };
  private aiStatusBar: HTMLElement | null = null;
  private aiUnsubscribe: (() => void) | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.init();
  }

  /**
   * Read settings from data.json. Users upgrading from 0.0.x keep the folders
   * that version had hard-coded; new installs start with them unset.
   */
  private async loadSettings(): Promise<void> {
    const raw: unknown = await this.loadData();
    const legacyHomeExists =
      raw === null ? await this.app.vault.adapter.exists(LEGACY_HOME_PATH) : false;
    const result = migratePluginData(raw, { legacyHomeExists });
    this.settings = result.settings;
    if (result.changed) await this.saveData(result.data);
  }

  /** Persist settings (other data.json keys are kept) and redraw dashboards. */
  async saveSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as Record<string, unknown>;
    data[SETTINGS_KEY] = this.settings;
    await this.saveData(data);
    this.refreshDashboards();
  }

  /** Text inputs save on every key stroke; redraw once typing pauses. */
  private refreshDashboards = debounce(
    () => {
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD)) {
        if (leaf.view instanceof DashboardView) leaf.view.refresh();
      }
    },
    600,
    true
  );

  openSettings(): void {
    const setting = (this.app as AppWithSetting).setting;
    if (!setting) return;
    setting.open();
    setting.openTabById(this.manifest.id);
  }

  private init(): void {
    registerBuiltinWidgets();

    this.registerView(VIEW_TYPE_DASHBOARD, (leaf) => new DashboardView(leaf, this));
    this.registerView(VIEW_TYPE_MAIL, (leaf) => new MailView(leaf, this));
    this.registerExtensions([DASHBOARD_EXTENSION], VIEW_TYPE_DASHBOARD);

    registerCommands(this);

    this.addRibbonIcon("layout-dashboard", "Open home dashboard", () => {
      (this.app as AppWithCommands).commands.executeCommandById("deck-dashboard:open-home");
    });
    this.addRibbonIcon("mail", "メールを開く", () => {
      (this.app as AppWithCommands).commands.executeCommandById("deck-dashboard:open-mail");
    });

    this.installAIStatusBar();

    // Settings tab (Settings → Community plugins → Deck)
    this.addSettingTab(new SyncSettingsTab(this.app, this));

    // Auto-sync watcher (task folder modifications → debounced Sheets sync)
    const watcher = new AutoSyncWatcher(this, this.app);
    void watcher.install();
  }

  onunload(): void {
    this.refreshDashboards.cancel();
    if (this.aiUnsubscribe) {
      this.aiUnsubscribe();
      this.aiUnsubscribe = null;
    }
    // The status bar element is auto-cleaned by Obsidian when the plugin
    // unloads (`addStatusBarItem` registers it for cleanup).
    this.aiStatusBar = null;
  }

  private installAIStatusBar(): void {
    const item = this.addStatusBarItem();
    item.addClass("nd-ai-statusbar");
    item.setAttribute("aria-label", "AI移譲セッション");
    item.addEventListener("click", () => {
      const vaultRoot = (this.app.vault.adapter as BasePathAdapter).getBasePath?.();
      new AISessionListModal({
        app: this.app,
        vaultRoot: vaultRoot ?? "",
        logFolder: this.settings.aiLogFolder,
        openSettings: () => this.openSettings(),
      }).open();
    });
    this.aiStatusBar = item;

    const registry = getAISessionRegistry();
    this.aiUnsubscribe = registry.onChange(() => this.refreshAIStatusBar());
    this.refreshAIStatusBar();
  }

  private refreshAIStatusBar(): void {
    if (!this.aiStatusBar) return;
    const registry = getAISessionRegistry();
    const running = registry.listRunning();
    const total = registry.list().length;

    this.aiStatusBar.empty();
    if (total === 0) {
      this.aiStatusBar.addClass("nd-ai-statusbar-empty");
      this.aiStatusBar.setText("🤖");
      this.aiStatusBar.setAttribute("aria-label", "AI移譲: アクティブなセッションなし");
      return;
    }
    this.aiStatusBar.removeClass("nd-ai-statusbar-empty");
    if (running.length > 0) this.aiStatusBar.addClass("nd-ai-statusbar-running");
    else this.aiStatusBar.removeClass("nd-ai-statusbar-running");

    const icon = running.length > 0 ? "⚡" : "🤖";
    const label =
      running.length > 0
        ? `${icon} AI ${running.length}実行中`
        : `${icon} AI ${total}件`;
    this.aiStatusBar.setText(label);
    this.aiStatusBar.setAttribute(
      "aria-label",
      `AI移譲: 実行中 ${running.length}件 / 合計 ${total}件`
    );
  }
}
