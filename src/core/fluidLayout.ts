import type { LayoutItem, WidgetInstance } from "./types";

/**
 * Fluid layout engine. Pure functions, no DOM.
 * Units: x and w are grid columns (12 across); y and rows are 8 px row units.
 * A widget's box is `rows * ROW - MARGIN` pixels tall, so MARGIN is the gap below it.
 */
export const FL = {
  COLS: 12,
  ROW: 8,
  GAP: 12,
  MARGIN: 12,
  MIN_W: 2,
  MIN_ROWS: 10,
  MIN_FIT_ROWS: 6,
  /** Below this grid width the dashboard shows one column in reading order. */
  STACK_BELOW: 640,
  /** A fit widget shrinks only after the smaller size has held this long (ms). */
  SHRINK_DELAY: 650,
  /** A fit widget grows to at most this share of the visible height, then scrolls. */
  CAP_FRACTION: 0.66,
} as const;

/** Widget types whose height can follow their content. */
export const FIT_TYPES = new Set(["note", "markdown", "dataview"]);

export interface PlacedBox {
  x: number;
  y: number;
  w: number;
  rows: number;
}

export interface FlowItem {
  i: string;
  x: number;
  y: number;
  w: number;
  rows: number;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Layout version 1 stored x and y as ordering hints and h as a count of 80 px steps. The old
 * renderer sorted by (y, x) and flowed widgets left to right in 12 columns, starting a new row
 * when the next widget did not fit, each row as tall as its tallest widget. This reproduces
 * that flow as real grid positions.
 */
export function legacyToGrid(layout: LayoutItem[], widgets?: Record<string, WidgetInstance>): LayoutItem[] {
  const items = [...layout].sort((a, b) => a.y - b.y || a.x - b.x);
  const out: LayoutItem[] = [];
  let col = 0;
  let rowTop = 0;
  let rowMax = 0;
  for (const it of items) {
    const w = clamp(Math.round(it.w) || FL.COLS, 1, FL.COLS);
    if (col + w > FL.COLS) {
      rowTop += rowMax;
      col = 0;
      rowMax = 0;
    }
    const rows = Math.max(FL.MIN_ROWS, Math.round((Math.max(2, it.h || 4) * 80 + FL.GAP) / FL.ROW));
    const entry: LayoutItem = { i: it.i, x: col, y: rowTop, w, h: rows };
    if (widgets?.[it.i] && FIT_TYPES.has(widgets[it.i].type)) entry.fit = true;
    out.push(entry);
    col += w;
    rowMax = Math.max(rowMax, rows);
  }
  return out;
}

/**
 * Vertical compaction. Every widget settles at the lowest row where it fits, so moving or
 * growing one pushes the ones below it down and closes any gap above them. A pinned widget
 * keeps the exact position it was given and the others flow around it.
 */
export function compact(items: FlowItem[], pinnedId?: string | null): Map<string, PlacedBox> {
  const placed: { x: number; y: number; w: number; r: number }[] = [];
  const pos = new Map<string, PlacedBox>();
  const place = (it: FlowItem, startY: number) => {
    const w = clamp(Math.round(it.w) || 1, 1, FL.COLS);
    const x = clamp(Math.round(it.x) || 0, 0, FL.COLS - w);
    const r = Math.max(1, Math.round(it.rows));
    let y = Math.max(0, Math.round(startY) || 0);
    for (;;) {
      let nextFree = Infinity;
      for (const p of placed) {
        if (x < p.x + p.w && x + w > p.x && y < p.y + p.r && y + r > p.y) nextFree = Math.min(nextFree, p.y + p.r);
      }
      if (nextFree === Infinity) break;
      y = nextFree;
    }
    placed.push({ x, y, w, r });
    pos.set(it.i, { x, y, w, rows: r });
  };
  const pinned = pinnedId == null ? undefined : items.find((it) => it.i === pinnedId);
  if (pinned) place(pinned, pinned.y);
  items
    .filter((it) => it !== pinned)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((it) => place(it, 0));
  return pos;
}

/** One column in reading order, for narrow panes and the phone. */
export function stackLayout(items: FlowItem[]): Map<string, PlacedBox> {
  const pos = new Map<string, PlacedBox>();
  let y = 0;
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    pos.set(it.i, { x: 0, y, w: FL.COLS, rows: it.rows });
    y += it.rows;
  }
  return pos;
}
