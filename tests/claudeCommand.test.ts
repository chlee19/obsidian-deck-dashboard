import { describe, expect, it } from "vitest";
import {
  commandForWidget,
  validateClaudeCommand,
  warnOnce,
  type ExecutableCheck,
} from "../src/core/claudeCommand";
import { FRESH_SETTINGS } from "../src/core/settings";

// Fake file system: only these absolute paths are executable files.
const exe = (paths: string[]): ExecutableCheck => (p) => paths.includes(p);
const none: ExecutableCheck = () => false;

describe("validateClaudeCommand", () => {
  it("accepts the bare claude command (looked up on PATH)", () => {
    expect(validateClaudeCommand("claude", none)).toEqual({ ok: true, command: "claude" });
    expect(validateClaudeCommand("  claude ", none)).toEqual({ ok: true, command: "claude" });
  });

  it("accepts an absolute path to an existing executable", () => {
    expect(validateClaudeCommand("/opt/tools/claude", exe(["/opt/tools/claude"]))).toEqual({
      ok: true,
      command: "/opt/tools/claude",
    });
    expect(validateClaudeCommand("/opt/tools/claude-wrapper", exe(["/opt/tools/claude-wrapper"]))).toEqual({
      ok: true,
      command: "/opt/tools/claude-wrapper",
    });
  });

  it("rejects absolute paths that are not an existing executable", () => {
    expect(validateClaudeCommand("/nowhere/claude", none)).toEqual({ ok: false, reason: "not-executable" });
  });

  it("rejects other bare commands and relative paths", () => {
    expect(validateClaudeCommand("bash", none)).toEqual({ ok: false, reason: "not-allowed" });
    expect(validateClaudeCommand("bin/claude", exe(["bin/claude"]))).toEqual({ ok: false, reason: "not-allowed" });
    expect(validateClaudeCommand("./claude", none)).toEqual({ ok: false, reason: "not-allowed" });
    expect(validateClaudeCommand("~/bin/claude", none)).toEqual({ ok: false, reason: "not-allowed" });
  });

  it("rejects line breaks and NUL characters", () => {
    expect(validateClaudeCommand("claude\nrm", none)).toEqual({ ok: false, reason: "control-chars" });
    expect(validateClaudeCommand("claude\r", none)).toEqual({ ok: false, reason: "control-chars" });
    expect(validateClaudeCommand("/opt/claude\u0000", exe(["/opt/claude"]))).toEqual({
      ok: false,
      reason: "control-chars",
    });
  });

  it("rejects an empty value", () => {
    expect(validateClaudeCommand("   ", none)).toEqual({ ok: false, reason: "empty" });
  });
});

describe("commandForWidget", () => {
  const settings = { ...FRESH_SETTINGS, claudeCommand: "/opt/tools/claude" };
  const check = exe(["/opt/tools/claude", "/tmp/other"]);

  it("uses the plugin setting, never the value stored in the .dashboard file", () => {
    const r = commandForWidget({ claudeCmd: "/tmp/other" }, settings, check);
    expect(r.check).toEqual({ ok: true, command: "/opt/tools/claude" });
    expect(r.ignored).toBe("/tmp/other");
  });

  it("reports nothing ignored when the dashboard has no value or the same value", () => {
    expect(commandForWidget({}, settings, check).ignored).toBeNull();
    expect(commandForWidget({ claudeCmd: "/opt/tools/claude" }, settings, check).ignored).toBeNull();
    expect(commandForWidget({ claudeCmd: "  " }, settings, check).ignored).toBeNull();
  });

  it("falls back to claude when the setting is empty", () => {
    const r = commandForWidget({}, { ...FRESH_SETTINGS, claudeCommand: "" }, none);
    expect(r.check).toEqual({ ok: true, command: "claude" });
  });

  it("passes on a rejected setting instead of running it", () => {
    const r = commandForWidget({}, { ...FRESH_SETTINGS, claudeCommand: "bash" }, none);
    expect(r.check.ok).toBe(false);
  });
});

describe("warnOnce", () => {
  it("is true only the first time for a key", () => {
    const seen = new Set<string>();
    expect(warnOnce(seen, "a")).toBe(true);
    expect(warnOnce(seen, "a")).toBe(false);
    expect(warnOnce(seen, "b")).toBe(true);
  });
});
