import { describe, expect, it } from "vitest";
import { formatYamlScalar, parseYamlScalar } from "../src/core/yamlScalar";
import { parseFrontmatter, serializeFrontmatter } from "../src/core/taskModel";

describe("formatYamlScalar", () => {
  it("leaves plain values as they are", () => {
    expect(formatYamlScalar("Website")).toBe("Website");
    expect(formatYamlScalar("2026-06-15")).toBe("2026-06-15");
    expect(formatYamlScalar("2h")).toBe("2h");
    expect(formatYamlScalar("作業中")).toBe("作業中");
  });

  it("quotes values YAML would read differently", () => {
    expect(formatYamlScalar("a: b")).toBe('"a: b"');
    expect(formatYamlScalar("#tag")).toBe('"#tag"');
    expect(formatYamlScalar("- item")).toBe('"- item"');
    expect(formatYamlScalar('say "hi"')).toBe('"say \\"hi\\""');
    expect(formatYamlScalar(" padded ")).toBe('" padded "');
  });

  it("turns line breaks and control characters into spaces", () => {
    expect(formatYamlScalar("one\ntwo")).toBe("one two");
    expect(formatYamlScalar("a\u0000b\u0007c")).toBe("a b c");
  });
});

describe("parseYamlScalar", () => {
  it("reads quoted values back", () => {
    expect(parseYamlScalar('"a: b"')).toBe("a: b");
    expect(parseYamlScalar('"say \\"hi\\""')).toBe('say "hi"');
    expect(parseYamlScalar("'it''s'")).toBe("it's");
    expect(parseYamlScalar("plain")).toBe("plain");
  });
});

describe("task frontmatter round trip", () => {
  it("keeps tricky values and cannot be broken out of with line breaks", () => {
    const fm = {
      PJT: "a: b\n---\nevil: injected",
      担当: '"quoted"',
      ラベル: "#tag",
      期限: "2026-06-15",
    };
    const text = serializeFrontmatter(fm);
    const back = parseFrontmatter(text.replace(/\n$/, ""));
    expect(back.evil).toBeUndefined();
    expect(back.PJT).toBe("a: b --- evil: injected");
    expect(back.担当).toBe('"quoted"');
    expect(back.ラベル).toBe("#tag");
    expect(back.期限).toBe("2026-06-15");
    expect(text.split("\n").filter(Boolean)).toHaveLength(4);
  });
});
