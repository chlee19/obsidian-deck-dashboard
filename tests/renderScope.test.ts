import { describe, expect, it, vi } from "vitest";
import { Component } from "obsidian";
import { RenderScope } from "../src/core/renderScope";

function fakeTarget() {
  const listeners = new Set<unknown>();
  return {
    listeners,
    addEventListener: (_type: string, cb: unknown) => listeners.add(cb),
    removeEventListener: (_type: string, cb: unknown) => listeners.delete(cb),
  };
}

describe("RenderScope", () => {
  it("unloads what the previous render registered before the next one starts", () => {
    const view = new Component();
    view.load();
    const scope = new RenderScope(view);

    const cleanup = vi.fn();
    scope.next().register(cleanup);
    expect(cleanup).not.toHaveBeenCalled();

    scope.next();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("removes document listeners added through the scope", () => {
    const view = new Component();
    view.load();
    const scope = new RenderScope(view);
    const doc = fakeTarget();

    scope.next().registerDomEvent(doc as any, "keydown", () => {});
    expect(doc.listeners.size).toBe(1);
    scope.next().registerDomEvent(doc as any, "keydown", () => {});
    expect(doc.listeners.size).toBe(1); // the first render's listener is gone
  });

  it("unloads per-widget children with their render", () => {
    const view = new Component();
    view.load();
    const scope = new RenderScope(view);
    const widget = scope.child(scope.next());
    const cleanup = vi.fn();
    widget.register(cleanup);

    scope.next();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up even when the view itself is not loaded yet", () => {
    const view = new Component(); // not loaded
    const scope = new RenderScope(view);
    const cleanup = vi.fn();
    scope.next().register(cleanup);
    scope.next();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("dispose() releases the current render (view closed)", () => {
    const view = new Component();
    view.load();
    const scope = new RenderScope(view);
    const cleanup = vi.fn();
    scope.next().register(cleanup);
    scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
    scope.dispose(); // idempotent
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
