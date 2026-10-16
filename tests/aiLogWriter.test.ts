import { describe, expect, it } from "vitest";
import { AILogWriter } from "../src/adapters/aiLogWriter";

function fakeApp() {
  const folders: string[] = [];
  return {
    folders,
    vault: {
      getAbstractFileByPath: (p: string) => (folders.includes(p) ? { path: p } : null),
      createFolder: async (p: string) => {
        folders.push(p);
      },
    },
  };
}

describe("AILogWriter.create", () => {
  it("writes into the configured log folder", async () => {
    const app = fakeApp();
    const w = await AILogWriter.create(app as any, "My task", "Logs/AI runs");
    expect(w.path.startsWith("Logs/AI runs/")).toBe(true);
    expect(w.path.endsWith("_My task.md")).toBe(true);
    expect(app.folders).toEqual(["Logs", "Logs/AI runs"]);
  });

  it("refuses to write anywhere while no folder is configured", async () => {
    await expect(AILogWriter.create(fakeApp() as any, "My task", "")).rejects.toThrow();
  });
});
