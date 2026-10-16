import { describe, expect, it } from "vitest";
import { SecretStore, migrateAllSecrets, secretBackendOf } from "../src/core/secrets";
import { updatePluginData } from "../src/core/pluginData";

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

describe("SecretStore under concurrent reads", () => {
  // loadData/saveData that yield between steps, like real disk I/O.
  function slowPlugin(data: Record<string, unknown>) {
    const secrets = new Map<string, string>();
    const state = { data };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    return {
      state,
      secrets,
      plugin: {
        app: {
          secretStorage: {
            getSecret: (id: string) => secrets.get(id) ?? null,
            setSecret: (id: string, v: string) => void secrets.set(id, v),
          },
        },
        loadData: async () => {
          await tick();
          return JSON.parse(JSON.stringify(state.data));
        },
        saveData: async (next: Record<string, unknown>) => {
          await tick();
          state.data = JSON.parse(JSON.stringify(next));
        },
      },
    };
  }

  it("leaves no plain-text secret in data.json when widgets read different keys at once", async () => {
    const { plugin, state } = slowPlugin({
      google_tokens: { access_token: "fake-a" },
      google_credentials: { client_id: "fake-id", client_secret: "fake-secret" },
      anthropic_api_key: "fake-key",
      other: 1,
    });
    const a = new SecretStore(plugin as any);
    const b = new SecretStore(plugin as any);
    await Promise.all([a.get("google_tokens"), b.get("anthropic_api_key"), a.get("google_credentials")]);
    expect(state.data).toEqual({ other: 1 });
  });

  it("removes a leftover copy from data.json even when secret storage already has the value", async () => {
    const { plugin, state, secrets } = slowPlugin({ anthropic_api_key: "stale-copy", other: 1 });
    secrets.set("deck-dashboard-anthropic-api-key", "fake-key");
    expect(await new SecretStore(plugin as any).get("anthropic_api_key")).toBe("fake-key");
    expect(state.data).toEqual({ other: 1 });
  });

  it("migrateAllSecrets moves every key in one go", async () => {
    const { plugin, state, secrets } = slowPlugin({
      google_tokens: { access_token: "fake-a" },
      anthropic_api_key: "fake-key",
      other: 1,
    });
    await migrateAllSecrets(plugin as any);
    expect(state.data).toEqual({ other: 1 });
    expect(secrets.get("deck-dashboard-anthropic-api-key")).toBe("fake-key");
    expect(JSON.parse(secrets.get("deck-dashboard-google-tokens")!)).toEqual({ access_token: "fake-a" });
  });
});

describe("updatePluginData", () => {
  it("runs read-modify-write steps one after another", async () => {
    const { plugin, state } = (() => {
      const state = { data: { n: 0 } as Record<string, unknown> };
      const tick = () => new Promise((r) => setTimeout(r, 0));
      return {
        state,
        plugin: {
          loadData: async () => {
            await tick();
            return { ...state.data };
          },
          saveData: async (next: Record<string, unknown>) => {
            await tick();
            state.data = { ...next };
          },
        },
      };
    })();
    await Promise.all(
      Array.from({ length: 5 }, () =>
        updatePluginData(plugin as any, (d) => {
          d.n = (d.n as number) + 1;
        })
      )
    );
    expect(state.data.n).toBe(5);
  });
});
