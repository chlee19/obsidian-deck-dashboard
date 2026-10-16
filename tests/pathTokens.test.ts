import { describe, expect, it } from "vitest";
import { expandFolderTokens } from "../src/core/pathTokens";

const folders = { taskFolder: "Work/Tasks", meetingNotesFolder: "", dailyNotesFolder: "Daily" };

describe("expandFolderTokens", () => {
  it("leaves queries without tokens untouched (existing dashboards keep their paths)", () => {
    const q = 'LIST FROM "Projects" WHERE status != "done"';
    expect(expandFolderTokens(q, folders)).toEqual({ ok: true, query: q });
  });

  it("replaces every occurrence of a configured token", () => {
    const r = expandFolderTokens('LIST FROM "{{taskFolder}}" OR "{{taskFolder}}/Sub"', folders);
    expect(r).toEqual({ ok: true, query: 'LIST FROM "Work/Tasks" OR "Work/Tasks/Sub"' });
  });

  it("reports which folders are missing instead of querying the whole vault", () => {
    const r = expandFolderTokens('LIST FROM "{{meetingFolder}}" OR "{{taskFolder}}"', folders);
    expect(r).toEqual({ ok: false, missing: ["meetingNotesFolder"] });
  });

  it("supports the daily notes token", () => {
    expect(expandFolderTokens('LIST FROM "{{dailyFolder}}"', folders)).toEqual({
      ok: true,
      query: 'LIST FROM "Daily"',
    });
  });
});
