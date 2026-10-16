import { describe, expect, it } from "vitest";
import { getStrings } from "../src/core/i18n";

function sample(value: unknown): string {
  return typeof value === "function" ? String((value as (x: string) => string)("x")) : String(value);
}

describe("getStrings", () => {
  it("returns Japanese for ja locales and English otherwise", () => {
    expect(getStrings("ja").openSettings).toBe("設定を開く");
    expect(getStrings("ja-JP").openSettings).toBe("設定を開く");
    expect(getStrings("en").openSettings).toBe("Open settings");
    expect(getStrings("fr").openSettings).toBe("Open settings");
    expect(getStrings("").openSettings).toBe("Open settings");
  });

  it("has every string filled in both languages", () => {
    const en = getStrings("en");
    const ja = getStrings("ja");
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
    for (const value of [...Object.values(en), ...Object.values(ja)]) {
      expect(sample(value).trim()).not.toBe("");
    }
  });

  it("fills placeholders in message functions", () => {
    expect(getStrings("en").folderNotSet("Task notes")).toContain("Task notes");
    expect(getStrings("ja").folderNotSet("タスクのノート")).toContain("タスクのノート");
  });
});
