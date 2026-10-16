import { describe, expect, it } from "vitest";
import { baseEmbedMarkdown, basesAvailable } from "../src/core/bases";
import { registerBuiltinWidgets, widgetRegistry } from "../src/widgets";

describe("basesAvailable", () => {
  it("is false on Obsidian versions without the API or with Bases turned off", () => {
    expect(basesAvailable({})).toBe(false);
    expect(basesAvailable({ internalPlugins: {} })).toBe(false);
    expect(basesAvailable({ internalPlugins: { getEnabledPluginById: () => null } })).toBe(false);
  });

  it("is true when the Bases core plugin is enabled", () => {
    const app = { internalPlugins: { getEnabledPluginById: (id: string) => (id === "bases" ? {} : null) } };
    expect(basesAvailable(app)).toBe(true);
  });
});

describe("baseEmbedMarkdown", () => {
  it("embeds the base file", () => {
    expect(baseEmbedMarkdown("Projects/Tasks.base", "")).toBe("![[Projects/Tasks.base]]");
  });
  it("embeds one named view", () => {
    expect(baseEmbedMarkdown("Tasks.base", "  Open  ")).toBe("![[Tasks.base#Open]]");
  });
});

describe("base widget", () => {
  it("is registered with an empty file by default", () => {
    registerBuiltinWidgets();
    const def = widgetRegistry.get("base");
    expect(def).toBeDefined();
    expect(def!.defaultSettings()).toEqual({ file: "", view: "" });
  });
});
