import { Redis } from "ioredis";

export type InboxEvent =
  | { type: "message"; conversationId: string; messageId: string; direction: "in" | "out" }
  | { type: "message_status"; conversationId: string; messageId: string; status: string }
  | { type: "lead"; leadId: string };

export type Realtime = {
  publish(tenantId: string, event: InboxEvent): Promise<void>;
  subscribe(tenantId: string, listener: (event: InboxEvent) => void): Promise<() => Promise<void>>;
  close(): Promise<void>;
};

const channelFor = (tenantId: string) => `crm:inbox:${tenantId}`;

// Pub/sub en Redis para que el inbox reciba los eventos aunque el worker y la
// conexión SSE estén en procesos distintos.
export function createRedisRealtime(redisUrl: string): Realtime {
  const publisher = new Redis(redisUrl, { maxRetriesPerRequest: 1, lazyConnect: false });
  const subscriber = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const listeners = new Map<string, Set<(event: InboxEvent) => void>>();

  publisher.on("error", () => undefined);
  subscriber.on("error", () => undefined);
  subscriber.on("message", (channel, raw) => {
    const set = listeners.get(channel);
    if (!set) return;
    let event: InboxEvent;
    try {
      event = JSON.parse(raw) as InboxEvent;
    } catch {
      return;
    }
    for (const listener of set) listener(event);
  });

  return {
    async publish(tenantId, event) {
      try {
        await publisher.publish(channelFor(tenantId), JSON.stringify(event));
      } catch {
        // El inbox se actualiza al recargar. Un fallo aquí no tumba el procesamiento.
      }
    },
    async subscribe(tenantId, listener) {
      const channel = channelFor(tenantId);
      let set = listeners.get(channel);
      if (!set) {
        set = new Set();
        listeners.set(channel, set);
        await subscriber.subscribe(channel);
      }
      set.add(listener);
      return async () => {
        const current = listeners.get(channel);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) {
          listeners.delete(channel);
          await subscriber.unsubscribe(channel).catch(() => undefined);
        }
      };
    },
    async close() {
      publisher.disconnect();
      subscriber.disconnect();
    },
  };
}

export function createNoopRealtime(): Realtime {
  return {
    async publish() {},
    async subscribe() {
      return async () => {};
    },
    async close() {},
  };
}
