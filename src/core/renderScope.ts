import { Component } from "obsidian";

/**
 * One child Component per render of a view. Widgets register their listeners,
 * Markdown/Dataview render children and cleanups on it; starting the next
 * render (or closing the view) unloads all of that, so nothing from an old
 * render stays alive behind the new one.
 */
export class RenderScope {
  private current: Component | null = null;

  constructor(private readonly owner: Component) {}

  /** Release the previous render and return a fresh, loaded scope. */
  next(): Component {
    this.dispose();
    const c = this.owner.addChild(new Component());
    // Load even if the owner is not loaded yet, so cleanups always run on
    // removeChild (an unloaded component skips them).
    c.load();
    this.current = c;
    return c;
  }

  /** A child of `scope` for one widget; unloaded together with the scope. */
  child(scope: Component): Component {
    return scope.addChild(new Component());
  }

  /** Release the current render (e.g. when the view closes). Idempotent. */
  dispose(): void {
    if (!this.current) return;
    this.owner.removeChild(this.current);
    this.current = null;
  }
}
