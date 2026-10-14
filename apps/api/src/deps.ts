import type { Database } from "./db.js";
import type { MetaClient } from "./meta.js";
import type { JobQueue } from "./queues.js";
import type { Realtime } from "./realtime.js";

export type Deps = {
  db: Database;
  meta: MetaClient;
  // Sin Redis no hay cola: los webhooks responden 503 y Meta los reenvía.
  queue: JobQueue | null;
  realtime: Realtime;
};
