import { migrate } from "./migrate.js";
import { buildApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? databaseUrl;
if (!databaseUrl || !migrateUrl) {
  throw new Error("Falta DATABASE_URL");
}

await migrate(migrateUrl);
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn("Falta REDIS_URL: los webhooks de Meta y el envío de WhatsApp quedan desactivados.");
}
const app = await buildApp({ databaseUrl, redisUrl, runWorkers: true });
const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
