import type { DeckSettings } from "./settings";

// Dataview queries in dashboards may say FROM "{{taskFolder}}" instead of a
// literal folder, so one dashboard works in any vault. Literal paths written
// in existing .dashboard files are left alone.
export const FOLDER_TOKENS = {
  taskFolder: "{{taskFolder}}",
  meetingNotesFolder: "{{meetingFolder}}",
  dailyNotesFolder: "{{dailyFolder}}",
} as const;

export type TokenFolderKey = keyof typeof FOLDER_TOKENS;

export type TokenExpansion =
  | { ok: true; query: string }
  | { ok: false; missing: TokenFolderKey[] };

export function expandFolderTokens(
  query: string,
  folders: Pick<DeckSettings, TokenFolderKey>
): TokenExpansion {
  const missing: TokenFolderKey[] = [];
  let out = query;
  for (const key of Object.keys(FOLDER_TOKENS) as TokenFolderKey[]) {
    const token = FOLDER_TOKENS[key];
    if (!out.includes(token)) continue;
    const value = folders[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    out = out.split(token).join(value);
  }
  return missing.length > 0 ? { ok: false, missing } : { ok: true, query: out };
}
