import { migrate } from "./migrate.js";

const connectionString = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_MIGRATE_URL o DATABASE_URL");
}

await migrate(connectionString);
console.info("Migraciones aplicadas");
