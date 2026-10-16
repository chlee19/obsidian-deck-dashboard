import type { Plugin } from "obsidian";
import { updatePluginData } from "./pluginData";

/** The data.json keys that hold credentials. */
export type SecretKey = "google_credentials" | "google_tokens" | "anthropic_api_key" | "ical_sources";

/** IDs in Obsidian's secret storage (lowercase alphanumeric with dashes). */
const SECRET_IDS: Record<SecretKey, string> = {
  google_credentials: "deck-dashboard-google-credentials",
  google_tokens: "deck-dashboard-google-tokens",
  anthropic_api_key: "deck-dashboard-anthropic-api-key",
  ical_sources: "deck-dashboard-ical-sources",
};

const ALL_KEYS = Object.keys(SECRET_IDS) as SecretKey[];

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
    const id = SECRET_IDS[key];
    const backend = this.backend();
    const stored = backend ? tryGet(backend, id) : null;
    let legacy: unknown = undefined;
    // Every data.json step goes through the shared queue, so concurrent
    // reads of different keys cannot save stale copies over each other.
    await updatePluginData(this.plugin, (data) => {
      if (!(key in data)) return false;
      const value = data[key];
      const empty = value === null || value === "";
      if (backend && (stored || empty || trySet(backend, id, encode(value)))) {
        // Already in (or now moved to) secret storage: drop the plain copy.
        if (!stored) legacy = value;
        delete data[key];
        return;
      }
      legacy = value; // no usable secret storage: keep using data.json
      return false;
    });
    if (stored) return decode<T>(key, stored);
    if (legacy === undefined || legacy === null || legacy === "") return null;
    return legacy as T;
  }

  /** Store a value, or clear it with null. */
  async set(key: SecretKey, value: unknown): Promise<void> {
    const backend = this.backend();
    const encoded = value === null || value === undefined ? "" : encode(value);
    const inSecretStorage = backend ? trySet(backend, SECRET_IDS[key], encoded) : false;
    await updatePluginData(this.plugin, (data) => {
      if (inSecretStorage || value === null || value === undefined) {
        if (!(key in data)) return false;
        delete data[key];
        return;
      }
      data[key] = value;
    });
  }
}

/**
 * Move every credential still in data.json into secret storage at once.
 * Run from onload before any view renders. No-op without secret storage.
 */
export async function migrateAllSecrets(plugin: Plugin): Promise<void> {
  const backend = secretBackendOf(plugin.app);
  if (!backend) return;
  await updatePluginData(plugin, (data) => {
    let changed = false;
    for (const key of ALL_KEYS) {
      if (!(key in data)) continue;
      const value = data[key];
      const already = tryGet(backend, SECRET_IDS[key]);
      if (!already && value !== null && value !== undefined && value !== "") {
        if (!trySet(backend, SECRET_IDS[key], encode(value))) continue; // keep it
      }
      delete data[key];
      changed = true;
    }
    return changed ? undefined : false;
  });
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
