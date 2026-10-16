import { describe, it, expect } from "vitest";
import {
  filterByScope,
  generateTaskId,
  isSyncEnabled,
  listTaskFiles,
  ownerFromPath,
  parseFrontmatter,
  serializeFrontmatter,
  TaskFrontmatter,
} from "../src/core/taskModel";
import type { TFile } from "obsidian";

describe("generateTaskId", () => {
  it("matches t-YYYYMMDD-6hex format", () => {
    const id = generateTaskId(new Date(2026, 4, 19));
    expect(id).toMatch(/^t-20260519-[0-9a-f]{6}$/);
  });

  it("zero-pads month and day", () => {
    const id = generateTaskId(new Date(2026, 0, 5));
    expect(id).toMatch(/^t-20260105-/);
  });

  it("produces different ids on consecutive calls", () => {
    const a = generateTaskId();
    const b = generateTaskId();
    expect(a).not.toBe(b);
  });
});

describe("isSyncEnabled", () => {
  it("returns true by default", () => {
    expect(isSyncEnabled({})).toBe(true);
  });
  it("returns false when sync: false", () => {
    expect(isSyncEnabled({ sync: false })).toBe(false);
  });
  it("returns false when sync is string 'false'", () => {
    expect(isSyncEnabled({ sync: "false" })).toBe(false);
  });
});

describe("parseFrontmatter", () => {
  it("parses flat key/value pairs", () => {
    const raw = "PJT: サンプルPJT\n期限: 2026-06-15\n優先度: High";
    const fm = parseFrontmatter(raw);
    expect(fm.PJT).toBe("サンプルPJT");
    expect(fm.期限).toBe("2026-06-15");
    expect(fm.優先度).toBe("High");
  });

  it("parses nested sync_meta block", () => {
    const raw = [
      "task_id: t-20260519-abc123",
      "sync_meta:",
      "  sheet_row: 5",
      "  last_sync: 2026-05-19T11:00:00Z",
      "  origin: vault",
    ].join("\n");
    const fm = parseFrontmatter(raw);
    expect(fm.task_id).toBe("t-20260519-abc123");
    expect(fm.sync_meta?.sheet_row).toBe(5);
    expect(fm.sync_meta?.last_sync).toBe("2026-05-19T11:00:00Z");
    expect(fm.sync_meta?.origin).toBe("vault");
  });

  it("coerces boolean literals", () => {
    const fm = parseFrontmatter("sync: false");
    expect(fm.sync).toBe(false);
  });
});

describe("serializeFrontmatter", () => {
  it("roundtrips flat keys", () => {
    const fm: TaskFrontmatter = {
      PJT: "技術",
      期限: "2026-07-01",
      status: "進行中",
      task_id: "t-20260519-xyz",
    };
    const text = serializeFrontmatter(fm);
    expect(text).toContain("PJT: 技術");
    expect(text).toContain("status: 進行中");
    expect(text).toContain("task_id: t-20260519-xyz");
  });

  it("writes sync_meta as nested block", () => {
    const fm: TaskFrontmatter = {
      task_id: "t-1",
      sync_meta: {
        sheet_row: 3,
        last_sync: "2026-05-19T12:00:00Z",
        origin: "sheets",
      },
    };
    const text = serializeFrontmatter(fm);
    expect(text).toContain("sync_meta:");
    expect(text).toContain("  sheet_row: 3");
    expect(text).toContain("  last_sync: 2026-05-19T12:00:00Z");
    expect(text).toContain("  origin: sheets");
  });

  it("skips undefined values", () => {
    const fm: TaskFrontmatter = { PJT: "X", 期限: undefined };
    const text = serializeFrontmatter(fm);
    expect(text).toContain("PJT: X");
    expect(text).not.toContain("期限");
  });
});

describe("ownerFromPath", () => {
  it("returns null for flat task files", () => {
    expect(ownerFromPath("Tasks/foo.md", "Tasks")).toBeNull();
  });
  it("returns owner segment for nested files", () => {
    expect(ownerFromPath("Tasks/alice/foo.md", "Tasks")).toBe("alice");
    expect(ownerFromPath("Tasks/bob/bar.md", "Tasks/")).toBe("bob");
  });
  it("works with a nested task folder", () => {
    expect(ownerFromPath("Work/Tasks/alice/foo.md", "Work/Tasks")).toBe("alice");
    expect(ownerFromPath("Work/Tasks/foo.md", "Work/Tasks")).toBeNull();
  });
});

describe("listTaskFiles", () => {
  const app = {
    vault: {
      getMarkdownFiles: () =>
        [
          { path: "Tasks/a.md" },
          { path: "Tasks/alice/b.md" },
          { path: "Tasksheet.md" },
          { path: "Notes/c.md" },
        ] as unknown as TFile[],
    },
  };
  it("lists notes under the configured task folder only", async () => {
    const files = await listTaskFiles(app as any, "Tasks");
    expect(files.map((f) => f.path)).toEqual(["Tasks/a.md", "Tasks/alice/b.md"]);
  });
  it("lists nothing while the task folder is not set", async () => {
    expect(await listTaskFiles(app as any, "")).toEqual([]);
  });
});

describe("filterByScope", () => {
  const mk = (path: string): TFile => ({ path } as unknown as TFile);
  const files = [
    mk("Tasks/flat-task.md"),
    mk("Tasks/alice/my-task.md"),
    mk("Tasks/bob/their-task.md"),
  ];

  it("personal scope includes flat + selfOwner folder", () => {
    const result = filterByScope(files, "personal", "alice", "Tasks").map((f) => f.path);
    expect(result).toContain("Tasks/flat-task.md");
    expect(result).toContain("Tasks/alice/my-task.md");
    expect(result).not.toContain("Tasks/bob/their-task.md");
  });

  it("org scope excludes flat AND selfOwner — only other members' tasks", () => {
    const result = filterByScope(files, "org", "alice", "Tasks").map((f) => f.path);
    expect(result).not.toContain("Tasks/flat-task.md");
    expect(result).not.toContain("Tasks/alice/my-task.md");
    expect(result).toContain("Tasks/bob/their-task.md");
  });

  it("personal scope excludes other members' tasks", () => {
    const result = filterByScope(files, "personal", "alice", "Tasks").map((f) => f.path);
    expect(result).not.toContain("Tasks/bob/their-task.md");
  });
});
