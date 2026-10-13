import { migrate } from "./migrate.js";
import { buildApp } from "./app.js";

const databaseUrl = process.env.DATABASE_URL;
const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? databaseUrl;
if (!databaseUrl || !migrateUrl) {
  throw new Error("Falta DATABASE_URL");
}

await migrate(migrateUrl);
const app = await buildApp({ databaseUrl });
const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
