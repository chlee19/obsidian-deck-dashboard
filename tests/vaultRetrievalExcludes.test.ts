import { describe, expect, it } from "vitest";
import { selectCandidates } from "../src/core/vaultRetrieval";

function fakeApp(paths: string[]) {
  return {
    vault: {
      configDir: ".obsidian",
      getMarkdownFiles: () => paths.map((path) => ({ path })),
      cachedRead: async () => "sample sample",
    },
  };
}

describe("selectCandidates excludes", () => {
  it("skips nothing beyond the built-in list when no excludes are given", async () => {
    const app = fakeApp(["Logs/sample.md", "Notes/sample.md"]);
    const out = await selectCandidates(app as any, "sample", {
      topK: 10,
      excerptChars: 20,
      folders: [],
      excludeFolders: [],
    });
    expect(out.map((c) => c.path).sort()).toEqual(["Logs/sample.md", "Notes/sample.md"]);
  });
});
