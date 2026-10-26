import { Notice, Platform, Plugin, TextFileView, WorkspaceLeaf } from "obsidian";
import type { Component } from "obsidian";
import { RenderScope } from "./renderScope";
import { VIEW_TYPE_DASHBOARD } from "./constants";
import {
  parseDashboard,
  serializeDashboard,
  createDefaultDashboard,
  DashboardParseError,
} from "./DashboardModel";
import type { Dashboard, LayoutItem, WidgetInstance } from "./types";
import { widgetRegistry } from "../widgets";
import { AddWidgetModal, EditWidgetModal } from "../ui/AddWidgetModal";
import type { DeckHost } from "./settings";
import { t } from "./i18n";
import { FL, FIT_TYPES, clamp, compact, legacyToGrid, stackLayout, type FlowItem, type PlacedBox } from "./fluidLayout";

/** The plugin as seen by a dashboard view. */
export type DashboardHost = Plugin & DeckHost;

interface WidgetDom {
  el: HTMLElement;
  head: HTMLElement;
  body: HTMLElement;
  /** Content wrapper of a fit-capable widget; its height is what "fit" measures. */
  inner: HTMLElement | null;
  chevron: HTMLElement;
  fitBtn: HTMLElement | null;
}

/** A drag or resize in progress: the widget it moves and where it currently wants to be. */
interface LiveEdit {
  id: string;
  x?: number;
  y?: number;
  w?: number;
  rows?: number;
}

interface PointerSession {
  move: (ev: PointerEvent) => void;
  up: () => void;
  key: (ev: KeyboardEvent) => void;
  scrollTimer: number;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export class DashboardView extends TextFileView {
  private dashboard: Dashboard = createDefaultDashboard("Untitled");
  private editMode = false;
  private plugin: DashboardHost;
  /** Everything widgets register lives here and is released on re-render. */
  private readonly renders = new RenderScope(this);
  private renderScope: Component | null = null;
  /** One child scope per widget, so reloading one widget releases only that widget. */
  private readonly widgetScopes = new Map<string, Component>();

  /** The file text as loaded. A version 1 file keeps this text on disk until something is edited. */
  private rawData = "";
  /**
   * True once the dashboard was changed in this view. Not called `dirty`: TextFileView owns
   * that name and clears it at the start of every save, which would make getViewData return
   * the unchanged file text.
   */
  private edited = false;

  private readonly wraps = new Map<string, WidgetDom>();
  private readonly fitState = new Map<string, { rows: number; pending: { rows: number; t: number } | null }>();
  /** Collapse toggled outside edit mode lasts for this session only. */
  private readonly sessionCollapsed = new Map<string, boolean>();
  private pos = new Map<string, PlacedBox>();
  private gridEl: HTMLElement | null = null;
  private slotEl: HTMLElement | null = null;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private delayTimer = 0;
  private stack = false;
  private live: LiveEdit | null = null;
  private pointer: PointerSession | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DashboardHost) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DASHBOARD;
  }

  getDisplayText(): string {
    return this.dashboard.title || this.file?.basename || "Dashboard";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  setViewData(data: string, _clear: boolean): void {
    try {
      this.dashboard = parseDashboard(data);
    } catch (e) {
      if (e instanceof DashboardParseError) {
        this.renderError(e.message);
        return;
      }
      throw e;
    }
    this.rawData = data;
    this.edited = false;
    this.fitState.clear();
    this.sessionCollapsed.clear();
    this.upgradeLayout();
    this.render();
  }

  getViewData(): string {
    return this.edited || !this.rawData ? serializeDashboard(this.dashboard) : this.rawData;
  }

  clear(): void {
    this.dashboard = createDefaultDashboard("Untitled");
    this.rawData = "";
    this.edited = false;
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async onClose(): Promise<void> {
    this.teardown();
    this.renders.dispose();
    this.widgetScopes.clear();
    this.containerEl.children[1].empty();
  }

  /** Re-render every widget (e.g. after Settings → Deck changed). */
  refresh(): void {
    this.render();
  }

  toggleEditMode(): void {
    this.editMode = !this.editMode;
    this.render();
  }

  openAddWidget(): void {
    new AddWidgetModal(this.app, (widget) => {
      this.addWidget(widget);
    }).open();
  }

  /** Version 1 layouts are converted in memory; the file changes only when something is edited. */
  private upgradeLayout(): void {
    const d = this.dashboard;
    if (d.layoutVersion === 2) return;
    d.layout = legacyToGrid(
      d.layout.filter((l) => d.widgets[l.i]),
      d.widgets
    );
    d.layoutVersion = 2;
  }

  private addWidget(widget: WidgetInstance): void {
    const id = `w_${Date.now().toString(36)}_${Math.floor(Math.random() * 1000)}`;
    const fitCapable = FIT_TYPES.has(widget.type);
    this.dashboard.widgets[id] = widget;
    // y far below everything: compaction moves it up to the first free row
    this.dashboard.layout.push({
      i: id,
      x: 0,
      y: 99999,
      w: fitCapable ? 6 : 12,
      h: fitCapable ? 24 : 48,
      ...(fitCapable ? { fit: true } : {}),
    });
    this.render();
    this.commitLayout();
  }

  private updateWidget(id: string, next: WidgetInstance): void {
    this.dashboard.widgets[id] = next;
    this.persist();
    this.render();
  }

  private deleteWidget(id: string): void {
    delete this.dashboard.widgets[id];
    this.dashboard.layout = this.dashboard.layout.filter((l) => l.i !== id);
    this.fitState.delete(id);
    this.persist();
    this.render();
    this.commitLayout();
  }

  private persist(): void {
    this.edited = true;
    this.dashboard.layoutVersion = 2;
    this.requestSave();
  }

  private isMobile(): boolean {
    return Platform.isMobile;
  }

  /** Dragging and resizing: desktop edit mode only, and not while stacked in one column. */
  private canArrange(): boolean {
    return this.editMode && !this.isMobile() && !this.stack;
  }

  private layoutOf(id: string): LayoutItem | undefined {
    return this.dashboard.layout.find((l) => l.i === id);
  }

  private layoutItems(): LayoutItem[] {
    return this.dashboard.layout.filter((l) => this.dashboard.widgets[l.i] && this.wraps.has(l.i));
  }

  private isCollapsed(l: LayoutItem): boolean {
    if (this.editMode) return !!l.collapsed;
    return this.sessionCollapsed.get(l.i) ?? !!l.collapsed;
  }

  private isFit(l: LayoutItem): boolean {
    const widget = this.dashboard.widgets[l.i];
    return !!widget && FIT_TYPES.has(widget.type) && l.fit !== false;
  }

  private capRows(): number {
    const scroller = this.containerEl.children[1] as HTMLElement | undefined;
    const h = scroller?.clientHeight || window.innerHeight;
    return Math.max(30, Math.floor((FL.CAP_FRACTION * h) / FL.ROW));
  }

  private teardown(): void {
    this.ro?.disconnect();
    this.ro = null;
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.delayTimer) window.clearTimeout(this.delayTimer);
    this.delayTimer = 0;
    this.endPointerSession();
    this.wraps.clear();
    this.pos = new Map();
    this.live = null;
    this.slotEl = null;
    this.gridEl = null;
  }

  private render(): void {
    this.teardown();
    this.renderScope = this.renders.next();
    this.widgetScopes.clear();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("deck-dashboard-view");

    const header = container.createDiv({ cls: "nd-header" });
    const titleEl = header.createEl("h1", { cls: "nd-title", text: this.dashboard.title });
    titleEl.contentEditable = "true";
    titleEl.addEventListener("blur", () => {
      const next = (titleEl.textContent ?? "").trim() || "Untitled";
      if (next !== this.dashboard.title) {
        this.dashboard.title = next;
        this.persist();
      }
    });
    titleEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleEl.blur();
      }
    });

    // The phone is view-only: layouts are arranged on the desktop and synced.
    const toolbar = header.createDiv({ cls: "nd-toolbar" });
    if (!this.isMobile()) {
      const addBtn = toolbar.createEl("button", { text: t().dashboardAddWidget, cls: "mod-cta nd-add-widget" });
      addBtn.addEventListener("click", () => this.openAddWidget());
      const editBtn = toolbar.createEl("button", {
        text: this.editMode ? t().dashboardDoneEditing : t().dashboardEditLayout,
        cls: "nd-edit-toggle",
      });
      editBtn.addEventListener("click", () => this.toggleEditMode());
    }

    const grid = container.createDiv({ cls: "nd-grid" });
    this.gridEl = grid;
    if (this.editMode && !this.isMobile()) grid.addClass("nd-edit");

    const items = this.dashboard.layout.filter((l) => this.dashboard.widgets[l.i]);
    if (items.length === 0) {
      grid.createEl("p", {
        cls: "nd-empty",
        text: this.isMobile() ? t().dashboardNoWidgetsMobile : t().dashboardNoWidgetsYetClickAdd,
      });
      return;
    }

    this.ro = new ResizeObserver(() => this.scheduleRelayout());
    this.ro.observe(grid);
    for (const item of items) this.renderWidget(grid, item, this.dashboard.widgets[item.i]);
    this.relayout();
    for (const item of items) this.mountWidget(item.i);
  }

  private renderWidget(grid: HTMLElement, layout: LayoutItem, widget: WidgetInstance): void {
    const id = layout.i;
    const fitCapable = FIT_TYPES.has(widget.type);
    const arrange = this.editMode && !this.isMobile();
    const wrap = grid.createDiv({ cls: "nd-widget" });
    wrap.dataset.layoutId = id;
    if (fitCapable) wrap.addClass("nd-widget-fitcapable");

    const head = wrap.createDiv({ cls: "nd-widget-head" });
    if (arrange) head.createSpan({ cls: "nd-drag-handle", text: "⋮⋮", attr: { title: t().dashboardDragTitleToMove } });
    const chevron = head.createSpan({ cls: "nd-collapse-toggle", attr: { title: t().dashboardCollapseOrExpand } });
    chevron.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleCollapse(id);
    });
    const titleEl = head.createEl("div", {
      cls: "nd-widget-title",
      text: widget.title ?? widgetRegistry.get(widget.type)?.label ?? widget.type,
    });
    titleEl.title = widget.type;

    const controls = head.createDiv({ cls: "nd-widget-controls" });
    const refreshBtn = controls.createEl("button", { text: "↻", attr: { title: t().dashboardReloadWidget } });
    refreshBtn.addEventListener("click", () => this.mountWidget(id));
    const editBtn = controls.createEl("button", { text: "⚙", attr: { title: t().dashboardWidgetSettings } });
    editBtn.addEventListener("click", () => {
      new EditWidgetModal(
        this.app,
        this.dashboard.widgets[id],
        (next) => this.updateWidget(id, next),
        () => this.deleteWidget(id)
      ).open();
    });
    let fitBtn: HTMLElement | null = null;
    if (arrange && fitCapable) {
      fitBtn = controls.createEl("button", { cls: "nd-fit-toggle", text: "⇕" });
      fitBtn.addEventListener("click", () => this.toggleFit(id));
    }

    const body = wrap.createDiv({ cls: "nd-widget-body" });
    const inner = fitCapable ? body.createDiv({ cls: "nd-widget-inner" }) : null;
    if (inner && this.ro) this.ro.observe(inner);
    this.wraps.set(id, { el: wrap, head, body, inner, chevron, fitBtn });

    head.addEventListener("pointerdown", (e) => {
      if (!this.canArrange() || e.button !== 0) return;
      if ((e.target as HTMLElement).closest(".nd-widget-controls, .nd-collapse-toggle")) return;
      this.startDrag(e, id);
    });

    if (arrange) {
      const handle = wrap.createDiv({ cls: "nd-resize-handle", attr: { title: t().dashboardResizeHint } });
      handle.addEventListener("pointerdown", (e) => {
        if (!this.canArrange() || e.button !== 0) return;
        this.startResize(e, id);
      });
      handle.addEventListener("dblclick", () => {
        const l = this.layoutOf(id);
        if (l && fitCapable) {
          l.fit = true;
          this.fitState.delete(id);
          this.relayout({ animate: true });
          this.commitLayout();
        }
      });
    }
  }

  /** Render (or re-render) one widget's content into its box. */
  private mountWidget(id: string): void {
    const w = this.wraps.get(id);
    const widget = this.dashboard.widgets[id];
    if (!w || !widget || !this.renderScope) return;
    const target = w.inner ?? w.body;
    const def = widgetRegistry.get(widget.type);
    if (!def) {
      target.empty();
      target.createEl("p", { cls: "nd-empty", text: t().dashboardUnsupportedWidget(widget.type) });
      return;
    }
    const old = this.widgetScopes.get(id);
    if (old) this.renderScope.removeChild(old);
    const scope = this.renders.child(this.renderScope);
    this.widgetScopes.set(id, scope);
    target.empty();
    Promise.resolve(
      def.render(target, widget.settings, {
        app: this.app,
        plugin: this.plugin,
        parent: scope,
        sourcePath: this.file?.path ?? "",
        settings: this.plugin.settings,
        openSettings: () => this.plugin.openSettings(),
      })
    ).catch((e) => {
      target.createEl("pre", { cls: "nd-error", text: `Render error: ${(e as Error).message}` });
    });
  }

  /** In edit mode the collapsed state is saved; otherwise it lasts for this session. */
  private toggleCollapse(id: string): void {
    const l = this.layoutOf(id);
    if (!l) return;
    if (this.editMode) {
      l.collapsed = !l.collapsed;
      this.relayout({ animate: true });
      this.commitLayout();
    } else {
      this.sessionCollapsed.set(id, !this.isCollapsed(l));
      this.relayout({ animate: true });
    }
  }

  private toggleFit(id: string): void {
    const l = this.layoutOf(id);
    if (!l) return;
    l.fit = !this.isFit(l);
    this.fitState.delete(id);
    this.relayout({ animate: true });
    this.commitLayout();
  }

  private scheduleRelayout(delay?: number): void {
    if (delay) {
      if (this.delayTimer) return;
      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = 0;
        this.relayout();
      }, delay);
      return;
    }
    if (this.raf) return;
    this.raf = window.requestAnimationFrame(() => {
      this.raf = 0;
      this.relayout();
    });
  }

  /**
   * Rows for a fit widget: grows at once, shrinks only after the smaller size has held for
   * SHRINK_DELAY, so a widget that empties and redraws itself does not make the page jump.
   */
  private fitRows(l: LayoutItem, w: WidgetDom): number {
    const inner = w.inner as HTMLElement;
    const chrome = w.el.offsetHeight - w.body.clientHeight;
    const natural = chrome + inner.offsetHeight;
    const cap = this.capRows();
    const rows = clamp(Math.ceil((natural + FL.MARGIN) / FL.ROW), FL.MIN_FIT_ROWS, cap);
    let st = this.fitState.get(l.i);
    if (!st) {
      st = { rows: Math.min(Math.max(l.h || rows, FL.MIN_FIT_ROWS), cap), pending: null };
      this.fitState.set(l.i, st);
    }
    if (rows >= st.rows) {
      st.rows = rows;
      st.pending = null;
    } else {
      const now = Date.now();
      if (st.pending && st.pending.rows === rows) {
        if (now - st.pending.t >= FL.SHRINK_DELAY) {
          st.rows = rows;
          st.pending = null;
        } else {
          this.scheduleRelayout(FL.SHRINK_DELAY);
        }
      } else {
        st.pending = { rows, t: now };
        this.scheduleRelayout(FL.SHRINK_DELAY);
      }
    }
    return st.rows;
  }

  private rowsFor(l: LayoutItem): number {
    const w = this.wraps.get(l.i) as WidgetDom;
    if (this.live?.id === l.i && this.live.rows) return this.live.rows;
    if (this.isCollapsed(l)) return Math.ceil((w.head.offsetHeight + 26 + FL.MARGIN) / FL.ROW);
    if (this.isFit(l) && w.inner) return this.fitRows(l, w);
    return Math.max(FL.MIN_ROWS, Math.round(l.h) || FL.MIN_ROWS);
  }

  private relayout(opts: { animate?: boolean } = {}): void {
    const grid = this.gridEl;
    if (!grid || !grid.isConnected) return;
    const width = grid.clientWidth;
    const stack = width > 0 && width < FL.STACK_BELOW;
    if (stack !== this.stack) {
      this.stack = stack;
      grid.toggleClass("nd-stack", stack);
    }

    const items = this.layoutItems();
    for (const l of items) {
      const w = this.wraps.get(l.i) as WidgetDom;
      const collapsed = this.isCollapsed(l);
      w.el.toggleClass("nd-collapsed", collapsed);
      w.chevron.setText(collapsed ? "▸" : "▾");
      if (w.fitBtn) {
        const fit = this.isFit(l);
        w.fitBtn.title = fit ? t().dashboardFitOn : t().dashboardFitOff;
        w.fitBtn.toggleClass("is-on", fit);
      }
    }

    const flow: FlowItem[] = items.map((l) => {
      const o = this.live?.id === l.i ? this.live : null;
      return { i: l.i, x: o?.x ?? l.x, y: o?.y ?? l.y, w: o?.w || l.w, rows: this.rowsFor(l) };
    });
    const pos = stack ? stackLayout(flow) : compact(flow, this.live?.id ?? null);

    const animate = opts.animate && !prefersReducedMotion();
    const before = animate ? new Map(items.map((l) => [l.i, this.wraps.get(l.i)!.el.getBoundingClientRect()])) : null;
    for (const l of items) {
      const p = pos.get(l.i)!;
      const el = this.wraps.get(l.i)!.el;
      el.style.gridColumn = stack ? "1 / -1" : `${p.x + 1} / span ${p.w}`;
      el.style.gridRow = `${p.y + 1} / span ${p.rows}`;
      el.style.height = `${p.rows * FL.ROW - FL.MARGIN}px`;
    }
    this.pos = pos;

    if (before) {
      for (const l of items) {
        if (this.live?.id === l.i) continue;
        const el = this.wraps.get(l.i)!.el;
        const a = before.get(l.i)!;
        const b = el.getBoundingClientRect();
        const dx = a.left - b.left;
        const dy = a.top - b.top;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
            duration: 170,
            easing: "cubic-bezier(0.2, 0, 0, 1)",
          });
        }
      }
    }

    if (this.slotEl && this.live) {
      const p = pos.get(this.live.id);
      if (p) {
        this.slotEl.style.gridColumn = `${p.x + 1} / span ${p.w}`;
        this.slotEl.style.gridRow = `${p.y + 1} / span ${p.rows}`;
        this.slotEl.style.height = `${p.rows * FL.ROW - FL.MARGIN}px`;
      }
    }
  }

  /** Write the positions the compaction settled on back into the layout, then save. */
  private commitLayout(): void {
    if (this.stack) return;
    for (const l of this.layoutItems()) {
      const p = this.pos.get(l.i);
      if (!p) continue;
      l.x = p.x;
      l.y = p.y;
      l.w = p.w;
      if (this.isFit(l) && !l.collapsed) l.h = p.rows;
    }
    this.persist();
  }

  private gridMetrics(): { rect: DOMRect; stepX: number } {
    const rect = (this.gridEl as HTMLElement).getBoundingClientRect();
    const colW = (rect.width - FL.GAP * (FL.COLS - 1)) / FL.COLS;
    return { rect, stepX: colW + FL.GAP };
  }

  private beginPointerSession(session: PointerSession): void {
    this.pointer = session;
    document.addEventListener("pointermove", session.move, true);
    document.addEventListener("pointerup", session.up, true);
    document.addEventListener("keydown", session.key, true);
  }

  private endPointerSession(): void {
    const s = this.pointer;
    if (!s) return;
    document.removeEventListener("pointermove", s.move, true);
    document.removeEventListener("pointerup", s.up, true);
    document.removeEventListener("keydown", s.key, true);
    window.clearInterval(s.scrollTimer);
    this.pointer = null;
  }

  /** Move a widget by its title bar. Escape cancels; the pane scrolls near its edges. */
  private startDrag(e: PointerEvent, id: string): void {
    e.preventDefault();
    const w = this.wraps.get(id);
    const p0 = this.pos.get(id);
    if (!w || !p0 || !this.gridEl) return;
    const m = this.gridMetrics();
    const scroller = this.containerEl.children[1] as HTMLElement;
    const cr = w.el.getBoundingClientRect();
    const originLeft = cr.left - m.rect.left;
    const originTop = cr.top - m.rect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    const scroll0 = scroller.scrollTop;
    const snapshot = this.dashboard.layout.map((x) => ({ ...x }));
    let lastEv = e;
    w.el.addClass("nd-dragging");
    this.slotEl = this.gridEl.createDiv({ cls: "nd-drop-slot" });

    const apply = (ev: PointerEvent) => {
      const left = originLeft + ev.clientX - startX;
      const top = originTop + ev.clientY - startY + (scroller.scrollTop - scroll0);
      this.live = {
        id,
        x: clamp(Math.round(left / m.stepX), 0, FL.COLS - p0.w),
        y: Math.max(0, Math.round(top / FL.ROW)),
      };
      this.relayout({ animate: true });
      const p = this.pos.get(id)!;
      w.el.style.transform = `translate(${left - p.x * m.stepX}px, ${top - p.y * FL.ROW}px)`;
    };

    const finish = (commit: boolean) => {
      const dropRect = w.el.getBoundingClientRect();
      const live = this.live;
      this.endPointerSession();
      w.el.removeClass("nd-dragging");
      w.el.style.transform = "";
      this.slotEl?.remove();
      this.slotEl = null;
      if (commit && live) {
        // keep exactly what the preview showed, the dragged widget pinned where it was dropped
        for (const it of this.layoutItems()) {
          const p = this.pos.get(it.i);
          if (!p) continue;
          it.x = p.x;
          it.y = p.y;
          it.w = p.w;
        }
      } else {
        this.dashboard.layout = snapshot;
      }
      this.live = null;
      this.relayout({ animate: true });
      const nr = w.el.getBoundingClientRect();
      const ddx = dropRect.left - nr.left;
      const ddy = dropRect.top - nr.top;
      if ((Math.abs(ddx) > 1 || Math.abs(ddy) > 1) && !prefersReducedMotion()) {
        w.el.animate([{ transform: `translate(${ddx}px, ${ddy}px)` }, { transform: "none" }], {
          duration: 170,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
        });
      }
      if (commit) this.commitLayout();
    };

    this.beginPointerSession({
      move: (ev) => {
        lastEv = ev;
        apply(ev);
      },
      up: () => finish(true),
      key: (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(false);
        }
      },
      scrollTimer: window.setInterval(() => {
        const r = scroller.getBoundingClientRect();
        const d = lastEv.clientY < r.top + 48 ? -16 : lastEv.clientY > r.bottom - 48 ? 16 : 0;
        if (d) {
          scroller.scrollTop += d;
          apply(lastEv);
        }
      }, 32),
    });
    apply(e);
  }

  /** Resize from the corner handle. The new height is pinned (fit off). Escape cancels. */
  private startResize(e: PointerEvent, id: string): void {
    e.preventDefault();
    e.stopPropagation();
    const w = this.wraps.get(id);
    const l = this.layoutOf(id);
    const p0 = this.pos.get(id);
    if (!w || !l || !p0) return;
    const m = this.gridMetrics();
    const scroller = this.containerEl.children[1] as HTMLElement;
    const scroll0 = scroller.scrollTop;
    const top0 = w.el.getBoundingClientRect().top;
    let last: { w: number; rows: number } | null = null;
    w.el.addClass("nd-resizing");

    const apply = (ev: PointerEvent) => {
      const right = ev.clientX - m.rect.left;
      const nw = clamp(Math.round((right + FL.GAP) / m.stepX) - p0.x, FL.MIN_W, FL.COLS - p0.x);
      const topNow = top0 - (scroller.scrollTop - scroll0);
      const rows = Math.max(FL.MIN_ROWS, Math.ceil((ev.clientY - topNow + FL.MARGIN) / FL.ROW));
      last = { w: nw, rows };
      this.live = { id, x: p0.x, y: p0.y, w: nw, rows };
      this.relayout();
    };

    const finish = (commit: boolean) => {
      this.endPointerSession();
      w.el.removeClass("nd-resizing");
      this.live = null;
      const done = commit ? last : null;
      if (done) {
        l.w = done.w;
        l.h = done.rows;
        l.fit = false;
        l.x = p0.x;
        l.y = p0.y;
        this.fitState.delete(id);
      }
      this.relayout({ animate: true });
      if (done) this.commitLayout();
    };

    this.beginPointerSession({
      move: (ev) => apply(ev),
      up: () => finish(true),
      key: (ev) => {
        if (ev.key === "Escape") {
          ev.preventDefault();
          finish(false);
        }
      },
      scrollTimer: 0,
    });
  }

  private renderError(message: string): void {
    const container = this.containerEl.children[1] as HTMLElement;
    this.teardown();
    this.renders.dispose();
    container.empty();
    container.createEl("h2", { text: "Failed to load dashboard" });
    container.createEl("pre", { text: message });
    const retryBtn = container.createEl("button", { text: t().dashboardRegenerateDefaults });
    retryBtn.addEventListener("click", () => {
      this.dashboard = createDefaultDashboard("Untitled");
      this.persist();
      this.render();
      new Notice("Dashboard reset to default");
    });
  }
}
