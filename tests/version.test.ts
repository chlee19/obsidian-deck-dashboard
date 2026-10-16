import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import * as path from "path";

const read = (f: string) => JSON.parse(readFileSync(path.resolve(__dirname, "..", f), "utf-8"));

describe("release metadata", () => {
  it("keeps manifest, package.json, package-lock.json and versions.json in step", () => {
    const manifest = read("manifest.json");
    const pkg = read("package.json");
    const lock = read("package-lock.json");
    const versions = read("versions.json");
    expect(pkg.version).toBe(manifest.version);
    expect(lock.version).toBe(manifest.version);
    expect(lock.packages[""].version).toBe(manifest.version);
    expect(versions[manifest.version]).toBe(manifest.minAppVersion);
  });
});
