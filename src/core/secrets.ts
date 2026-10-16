import type { Plugin } from "obsidian";

/** The data.json keys that hold credentials. */
export type SecretKey = "google_credentials" | "google_tokens" | "anthropic_api_key";

/** IDs in Obsidian's secret storage (lowercase alphanumeric with dashes). */
const SECRET_IDS: Record<SecretKey, string> = {
  google_credentials: "deck-dashboard-google-credentials",
  google_tokens: "deck-dashboard-google-tokens",
  anthropic_api_key: "deck-dashboard-anthropic-api-key",
};

/** Obsidian's SecretStorage (1.11.4+). */
export interface SecretBackend {
  getSecret(id: string): string | null;
  setSecret(id: string, secret: string): void;
}

/** app.secretStorage when this Obsidian version has it, otherwise null. */
export function secretBackendOf(app: unknown): SecretBackend | null {
  const s = (app as { secretStorage?: Partial<SecretBackend> } | null)?.secretStorage;
  if (typeof s?.getSecret !== "function" || typeof s.setSecret !== "function") return null;
  return s as SecretBackend;
}

type PluginData = Record<string, unknown>;

/**
 * Credentials live in Obsidian's secret storage when available, so they are
 * not written to data.json in plain text. Values still found in data.json
 * (from older versions) are moved there on first read. On Obsidian versions
 * without secret storage, or where it refuses (no keychain on this device),
 * data.json keeps being used.
 *
 * Strings are stored as is; objects as JSON.
 */
export class SecretStore {
  constructor(private readonly plugin: Plugin) {}

  private backend(): SecretBackend | null {
    return secretBackendOf(this.plugin.app);
  }

  async get<T = unknown>(key: SecretKey): Promise<T | null> {
    const backend = this.backend();
    if (backend) {
      const raw = tryGet(backend, SECRET_IDS[key]);
      if (raw) return decode<T>(key, raw);
    }
    const data = ((await this.plugin.loadData()) ?? {}) as PluginData;
    const legacy = data[key];
    if (legacy === undefined || legacy === null || legacy === "") return null;
    if (backend && trySet(backend, SECRET_IDS[key], encode(legacy))) {
      delete data[key];
      await this.plugin.saveData(data);
    }
    return legacy as T;
  }

  /** Store a value, or clear it with null. */
  async set(key: SecretKey, value: unknown): Promise<void> {
    const backend = this.backend();
    const data = ((await this.plugin.loadData()) ?? {}) as PluginData;
    const encoded = value === null || value === undefined ? "" : encode(value);
    if (backend && trySet(backend, SECRET_IDS[key], encoded)) {
      if (key in data) {
        delete data[key];
        await this.plugin.saveData(data);
      }
      return;
    }
    if (value === null || value === undefined) delete data[key];
    else data[key] = value;
    await this.plugin.saveData(data);
  }
}

function tryGet(backend: SecretBackend, id: string): string | null {
  try {
    return backend.getSecret(id);
  } catch {
    return null;
  }
}

/** False when secure storage is not usable here (it throws). */
function trySet(backend: SecretBackend, id: string, value: string): boolean {
  try {
    backend.setSecret(id, value);
    return true;
  } catch {
    return false;
  }
}

function encode(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function decode<T>(key: SecretKey, raw: string): T | null {
  if (key === "anthropic_api_key") return raw as unknown as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
