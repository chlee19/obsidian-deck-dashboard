import type { Plugin } from "obsidian";

type PluginData = Record<string, unknown>;
type DataOwner = Pick<Plugin, "loadData" | "saveData">;

// One queue per plugin: every read-modify-write of data.json waits for the
// previous one, so two writers can never save over each other's changes.
const queues = new WeakMap<object, Promise<unknown>>();

function enqueue<T>(plugin: DataOwner, job: () => Promise<T>): Promise<T> {
  const prev = queues.get(plugin) ?? Promise.resolve();
  const next = prev.then(job, job);
  queues.set(
    plugin,
    next.catch(() => undefined)
  );
  return next;
}

/**
 * Read data.json, let `mutate` change it, and save — serialized with every
 * other call for the same plugin. `mutate` returns false to skip saving.
 */
export function updatePluginData<T = void>(
  plugin: DataOwner,
  mutate: (data: PluginData) => T | false | Promise<T | false>
): Promise<T | undefined> {
  return enqueue(plugin, async () => {
    const data = (((await plugin.loadData()) as PluginData | null) ?? {}) as PluginData;
    const result = await mutate(data);
    if (result === false) return undefined;
    await plugin.saveData(data);
    return result;
  });
}

/** Read data.json after any pending writes have finished. */
export function readPluginData(plugin: DataOwner): Promise<PluginData> {
  return enqueue(plugin, async () => (((await plugin.loadData()) as PluginData | null) ?? {}) as PluginData);
}
