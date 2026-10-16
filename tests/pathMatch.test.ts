import { describe, expect, it } from "vitest";
import { matchPaths } from "../src/core/pathMatch";

describe("matchPaths", () => {
  const paths = ["Work/Tasks", "Tasks", "Archive/Old tasks", "Daily", "Work"];

  it("returns everything (shortest first) for an empty query", () => {
    expect(matchPaths(paths, "")).toEqual(["Work", "Daily", "Tasks", "Work/Tasks", "Archive/Old tasks"]);
  });

  it("matches case-insensitively and ranks prefix matches first", () => {
    expect(matchPaths(paths, "task")).toEqual(["Tasks", "Work/Tasks", "Archive/Old tasks"]);
  });

  it("limits the number of results", () => {
    expect(matchPaths(paths, "", 2)).toEqual(["Work", "Daily"]);
  });
});
