import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import * as path from "path";

const root = path.resolve(__dirname, "..");
const readme = readFileSync(path.join(root, "README.md"), "utf-8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("README", () => {
  it("discloses every external host the plugin talks to (Obsidian developer policy)", () => {
    const hosts = new Set<string>();
    for (const file of sourceFiles(path.join(root, "src"))) {
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(/https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)) hosts.add(m[1]);
    }
    expect(hosts.size).toBeGreaterThan(0);
    for (const host of hosts) expect(readme, `README does not mention ${host}`).toContain(host);
  });

  it("mentions the local tools it can start", () => {
    expect(readme).toContain("127.0.0.1");
    expect(readme).toMatch(/`claude`/);
  });

  it("describes the released plugin, not the first scaffold", () => {
    expect(readme).not.toMatch(/No widgets yet|Phase 1 scaffold/);
    expect(readme).toMatch(/Community plugins/);
  });
});
