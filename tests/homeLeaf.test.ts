import { describe, expect, it } from "vitest";
import { findLeafShowingFile, startupLeafMode } from "../src/core/homeLeaf";

function leaf(file?: string) {
  return { getViewState: () => ({ type: "deck-dashboard-view", state: file ? { file } : {} }) };
}

describe("findLeafShowingFile", () => {
  it("finds the tab that already shows the home dashboard", () => {
    const a = leaf("Other.dashboard");
    const b = leaf("Boards/Home.dashboard");
    expect(findLeafShowingFile([a, b], "Boards/Home.dashboard")).toBe(b);
  });

  it("works for tabs restored but not loaded yet (deferred views)", () => {
    // A deferred leaf still reports its file through the view state.
    const deferred = { getViewState: () => ({ type: "deck-dashboard-view", state: { file: "Home.dashboard" } }) };
    expect(findLeafShowingFile([deferred], "Home.dashboard")).toBe(deferred);
  });

  it("returns null when no tab shows it", () => {
    expect(findLeafShowingFile([leaf("Other.dashboard"), leaf()], "Home.dashboard")).toBeNull();
  });
});

describe("startupLeafMode", () => {
  it("reuses an empty tab instead of leaving it behind", () => {
    expect(startupLeafMode("empty")).toBe("reuse");
  });
  it("opens a new tab rather than replacing the note the user had open", () => {
    expect(startupLeafMode("markdown")).toBe("tab");
    expect(startupLeafMode(undefined)).toBe("tab");
  });
});
