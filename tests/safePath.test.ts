import { describe, expect, it } from "vitest";
import { safeFolderName, safeVaultPath, sanitizeFileTitle } from "../src/core/safePath";

describe("safeVaultPath", () => {
  it("accepts paths inside the expected folder (and normalizes empty segments)", () => {
    expect(safeVaultPath("Tasks/alice/a.md", "Tasks")).toEqual({ ok: true, path: "Tasks/alice/a.md" });
    expect(safeVaultPath("Tasks//a.md", "Tasks/")).toEqual({ ok: true, path: "Tasks/a.md" });
    expect(safeVaultPath("Tasks", "Tasks")).toEqual({ ok: true, path: "Tasks" });
    expect(safeVaultPath("Notes/a.md", "")).toEqual({ ok: true, path: "Notes/a.md" });
  });

  it("rejects parent-directory segments", () => {
    expect(safeVaultPath("../outside.md", "").ok).toBe(false);
    expect(safeVaultPath("Tasks/../../outside.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath("Tasks/..", "Tasks").ok).toBe(false);
  });

  it("rejects absolute paths, backslashes and drive letters", () => {
    expect(safeVaultPath("/etc/x.md", "").ok).toBe(false);
    expect(safeVaultPath("Tasks\\..\\x.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath("C:/x.md", "").ok).toBe(false);
  });

  it("rejects control characters and hidden segments", () => {
    expect(safeVaultPath("Tasks/a\nb.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath("Tasks/a\u0000.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath(".obsidian/plugins/x.md", "").ok).toBe(false);
    expect(safeVaultPath("Tasks/./a.md", "Tasks").ok).toBe(false);
  });

  it("rejects paths outside the expected folder", () => {
    expect(safeVaultPath("Other/a.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath("Tasksheet/a.md", "Tasks").ok).toBe(false);
    expect(safeVaultPath("", "").ok).toBe(false);
  });
});

describe("safeFolderName", () => {
  it("accepts one plain folder name", () => {
    expect(safeFolderName("alice")).toBe("alice");
    expect(safeFolderName("  bob  ")).toBe("bob");
  });
  it("rejects anything that is not exactly one safe segment", () => {
    for (const bad of ["", "a/b", "a\\b", "..", ".", ".hidden", "a\tb", "a\nb", "../x"]) {
      expect(safeFolderName(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe("sanitizeFileTitle", () => {
  it("replaces path characters and removes control characters", () => {
    expect(sanitizeFileTitle("a/b:c")).toBe("a_b_c");
    expect(sanitizeFileTitle("line1\nline2\r\tend")).toBe("line1 line2 end");
    expect(sanitizeFileTitle("../../x")).toBe("_.._x");
    expect(sanitizeFileTitle("..hidden")).toBe("hidden");
    expect(sanitizeFileTitle("\u0000\n")).toBe("Untitled");
  });
});
