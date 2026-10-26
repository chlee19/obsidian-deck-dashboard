import { test, expect } from "vitest";
import { FL, legacyToGrid as flLegacyToGrid, compact as flCompact } from "../src/core/fluidLayout";
import type { FlowItem, PlacedBox } from "../src/core/fluidLayout";
import type { WidgetInstance } from "../src/core/types";

type Box = { x: number; y: number; w: number; rows: number };
const widgets = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, type]) => [k, { type, settings: {} } as WidgetInstance]));

const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.rows && a.y + a.rows > b.y;
function check(pos: Map<string, PlacedBox>, items: FlowItem[]) {
  const arr = items.map((it) => ({ i: it.i, ...pos.get(it.i)! }));
  for (const p of arr) {
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.w).toBeLessThanOrEqual(FL.COLS);
    expect(p.y).toBeGreaterThanOrEqual(0);
  }
  for (let a = 0; a < arr.length; a++) for (let b = a + 1; b < arr.length; b++) expect(overlap(arr[a], arr[b])).toBe(false);
  return arr;
}
function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296; }

test("legacy flow: full-width widgets stack in (y, x) order with their old heights", () => {
  const layout = [
    { i: "a", x: 0, y: 0, w: 12, h: 4 },
    { i: "b", x: 6, y: 5, w: 12, h: 4 },
    { i: "c", x: 0, y: 4, w: 12, h: 5 },
  ];
  const out = flLegacyToGrid(layout, widgets({ a: "note", b: "note", c: "kanban" }));
  expect(out.map((o) => o.i)).toEqual(["a", "c", "b"]);
  expect(out.every((o) => o.x === 0 && o.w === 12)).toBe(true);
  expect(out[1].y).toBe(out[0].y + out[0].h);
  expect(out[0].fit).toBe(true);
  expect(out[1].fit).toBeUndefined();
});

test("legacy flow: 4-wide widgets share a row and the row is as tall as its tallest", () => {
  const layout = [
    { i: "a", x: 0, y: 0, w: 4, h: 10 },
    { i: "b", x: 4, y: 1, w: 4, h: 4 },
    { i: "c", x: 8, y: 2, w: 4, h: 6 },
    { i: "d", x: 0, y: 3, w: 4, h: 4 },
  ];
  const out = flLegacyToGrid(layout, {});
  expect(out.map((o) => [o.x, o.y === 0 ? 0 : 1])).toEqual([[0, 0], [4, 0], [8, 0], [0, 1]]);
  expect(out[3].y).toBe(out[0].h);
});

test("compaction: random layouts never overlap, stay inside 12 columns, and have no floating widgets", () => {
  const r = rng(7);
  for (let n = 0; n < 300; n++) {
    const items = Array.from({ length: 1 + Math.floor(r() * 14) }, (_, k) => {
      const w = FL.MIN_W + Math.floor(r() * 11);
      return { i: "w" + k, x: Math.floor(r() * 12), y: Math.floor(r() * 80), w, rows: 6 + Math.floor(r() * 60) };
    });
    const pinned = r() < 0.5 ? items[Math.floor(r() * items.length)].i : null;
    const pos = flCompact(items, pinned);
    const arr = check(pos, items);
    for (const p of arr) {
      if (p.i === pinned || p.y === 0) continue;
      const up = { ...p, y: p.y - 1 };
      expect(arr.some((q: Box & { i: string }) => q.i !== p.i && overlap(up, q))).toBe(true);
    }
  }
});

test("compaction: a pinned widget keeps its exact spot and the others flow around it", () => {
  const items = [
    { i: "a", x: 0, y: 0, w: 12, rows: 20 },
    { i: "b", x: 0, y: 20, w: 12, rows: 20 },
    { i: "m", x: 0, y: 100, w: 6, rows: 10 },
  ];
  const pos = flCompact(items, "m");
  expect(pos.get("m")!.y).toBe(100);
  expect(pos.get("a")!.y).toBe(0);
  expect(pos.get("b")!.y).toBe(20);
  const moved = flCompact([items[0], items[1], { ...items[2], y: 10 }], "m");
  expect(moved.get("m")!.y).toBe(10);
  expect(moved.get("a")!.y).toBe(20);
  expect(moved.get("b")!.y).toBe(40);
  check(moved, items);
});

test("compaction: growing a widget pushes the one below down; shrinking closes the gap", () => {
  let items = [{ i: "a", x: 0, y: 0, w: 12, rows: 20 }, { i: "b", x: 0, y: 20, w: 12, rows: 10 }];
  expect(flCompact(items).get("b")!.y).toBe(20);
  items = [{ ...items[0], rows: 35 }, items[1]];
  expect(flCompact(items).get("b")!.y).toBe(35);
  items = [{ ...items[0], rows: 8 }, items[1]];
  expect(flCompact(items).get("b")!.y).toBe(8);
});

test("compaction: side-by-side widgets keep their columns and fill upward independently", () => {
  const items = [
    { i: "l", x: 0, y: 0, w: 6, rows: 40 },
    { i: "r1", x: 6, y: 0, w: 6, rows: 10 },
    { i: "r2", x: 6, y: 50, w: 6, rows: 10 },
  ];
  const pos = flCompact(items);
  expect(pos.get("r2")!.y).toBe(10);
});
