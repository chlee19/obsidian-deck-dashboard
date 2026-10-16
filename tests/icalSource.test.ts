import { describe, expect, it } from "vitest";
import { checkCalendarUrl, resolveCalendarSource } from "../src/core/icalSource";

describe("checkCalendarUrl", () => {
  it("accepts public http(s) addresses", () => {
    expect(checkCalendarUrl("https://calendar.example.com/a.ics", false)).toEqual({
      ok: true,
      url: "https://calendar.example.com/a.ics",
    });
    expect(checkCalendarUrl("http://172.32.0.1/a.ics", false).ok).toBe(true);
  });

  it("treats webcal:// as https://", () => {
    expect(checkCalendarUrl("webcal://example.com/a.ics", false)).toEqual({
      ok: true,
      url: "https://example.com/a.ics",
    });
  });

  it("rejects other schemes and malformed input", () => {
    expect(checkCalendarUrl("file:///etc/hosts", false)).toEqual({ ok: false, reason: "scheme" });
    expect(checkCalendarUrl("javascript:alert(1)", false)).toEqual({ ok: false, reason: "scheme" });
    expect(checkCalendarUrl("not a url", false)).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not fetch local, private or link-local addresses by default", () => {
    for (const url of [
      "http://localhost:8080/a.ics",
      "http://app.localhost/a.ics",
      "http://printer.local/a.ics",
      "http://127.0.0.1/a.ics",
      "http://0.0.0.0/a.ics",
      "http://10.1.2.3/a.ics",
      "http://172.16.0.1/a.ics",
      "http://172.31.255.255/a.ics",
      "http://192.168.0.5/a.ics",
      "http://169.254.169.254/latest",
      "http://[::1]/a.ics",
      "http://[fe80::1]/a.ics",
      "http://[fd00::1]/a.ics",
    ]) {
      expect(checkCalendarUrl(url, false), url).toEqual({ ok: false, reason: "private" });
    }
  });

  it("allows them when the user turned that on", () => {
    expect(checkCalendarUrl("http://192.168.0.5/a.ics", true).ok).toBe(true);
  });
});

describe("resolveCalendarSource", () => {
  const sources = { work: "https://example.com/work.ics" };

  it("looks up a registered name", () => {
    expect(resolveCalendarSource({ source: "work", icalUrl: "" }, sources)).toEqual({
      kind: "url",
      url: "https://example.com/work.ics",
      fromName: true,
    });
  });

  it("reports an unknown name instead of falling back", () => {
    expect(resolveCalendarSource({ source: "home", icalUrl: "https://x.example/a.ics" }, sources)).toEqual({
      kind: "unknown-name",
      name: "home",
    });
  });

  it("still reads a URL written in older dashboards", () => {
    expect(resolveCalendarSource({ icalUrl: " https://x.example/a.ics " }, sources)).toEqual({
      kind: "url",
      url: "https://x.example/a.ics",
      fromName: false,
    });
  });

  it("is unset when neither is given", () => {
    expect(resolveCalendarSource({ source: "", icalUrl: "" }, sources)).toEqual({ kind: "unset" });
  });
});
