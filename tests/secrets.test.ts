import { describe, expect, it } from "vitest";
import { SecretStore, secretBackendOf } from "../src/core/secrets";

function fakePlugin(data: Record<string, unknown> | null, withStorage: boolean) {
  const secrets = new Map<string, string>();
  const state = { data, saves: 0 };
  const plugin = {
    app: withStorage
      ? {
          secretStorage: {
            getSecret: (id: string) => secrets.get(id) ?? null,
            setSecret: (id: string, v: string) => void secrets.set(id, v),
            listSecrets: () => [...secrets.keys()],
          },
        }
      : {},
    loadData: async () => (state.data ? { ...state.data } : null),
    saveData: async (next: Record<string, unknown>) => {
      state.data = next;
      state.saves++;
    },
  };
  return { plugin, secrets, state };
}

describe("secretBackendOf", () => {
  it("is null on Obsidian versions without SecretStorage", () => {
    expect(secretBackendOf({})).toBeNull();
    expect(secretBackendOf({ secretStorage: {} })).toBeNull();
  });
});

describe("SecretStore with SecretStorage available", () => {
  it("moves a value found in data.json into secret storage on first read", async () => {
    const { plugin, secrets, state } = fakePlugin({ anthropic_api_key: "fake-key", other: 1 }, true);
    const store = new SecretStore(plugin as any);
    expect(await store.get("anthropic_api_key")).toBe("fake-key");
    expect(secrets.get("deck-dashboard-anthropic-api-key")).toBe("fake-key");
    expect(state.data).toEqual({ other: 1 }); // removed from data.json, rest kept
  });

  it("writes new values to secret storage only", async () => {
    const { plugin, secrets, state } = fakePlugin({ other: 1 }, true);
    const store = new SecretStore(plugin as any);
    await store.set("google_tokens", { access_token: "fake-a", refresh_token: "fake-r" });
    expect(JSON.parse(secrets.get("deck-dashboard-google-tokens")!)).toEqual({
      access_token: "fake-a",
      refresh_token: "fake-r",
    });
    expect(state.data).toEqual({ other: 1 });
    expect(await store.get("google_tokens")).toEqual({ access_token: "fake-a", refresh_token: "fake-r" });
  });

  it("clears a secret", async () => {
    const { plugin } = fakePlugin(null, true);
    const store = new SecretStore(plugin as any);
    await store.set("google_tokens", { access_token: "fake" });
    await store.set("google_tokens", null);
    expect(await store.get("google_tokens")).toBeNull();
  });
});

describe("SecretStore without SecretStorage (older Obsidian)", () => {
  it("keeps using data.json", async () => {
    const { plugin, state } = fakePlugin({ other: 1 }, false);
    const store = new SecretStore(plugin as any);
    await store.set("anthropic_api_key", "fake-key");
    expect(state.data).toEqual({ other: 1, anthropic_api_key: "fake-key" });
    expect(await store.get("anthropic_api_key")).toBe("fake-key");
    await store.set("anthropic_api_key", null);
    expect(state.data).toEqual({ other: 1 });
  });
});

describe("SecretStore when secure storage refuses (no keychain)", () => {
  function brokenStoragePlugin(data: Record<string, unknown>) {
    const state = { data };
    return {
      state,
      plugin: {
        app: {
          secretStorage: {
            getSecret: () => null,
            setSecret: () => {
              throw new Error("Secure storage is not available.");
            },
          },
        },
        loadData: async () => ({ ...state.data }),
        saveData: async (next: Record<string, unknown>) => {
          state.data = next;
        },
      },
    };
  }

  it("leaves existing values in data.json", async () => {
    const { plugin, state } = brokenStoragePlugin({ anthropic_api_key: "fake-key" });
    const store = new SecretStore(plugin as any);
    expect(await store.get("anthropic_api_key")).toBe("fake-key");
    expect(state.data).toEqual({ anthropic_api_key: "fake-key" });
  });

  it("falls back to data.json for new values", async () => {
    const { plugin, state } = brokenStoragePlugin({});
    const store = new SecretStore(plugin as any);
    await store.set("anthropic_api_key", "fake-key");
    expect(state.data).toEqual({ anthropic_api_key: "fake-key" });
  });
});
