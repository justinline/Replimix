import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in .env");
}

const client = postgres(databaseUrl);

export const db = drizzle(client, { schema });
export const replicacheServerId = 1;

await db.execute(
  sql`INSERT INTO replicache_server (id, version) VALUES (${replicacheServerId}, 1) ON CONFLICT (id) DO NOTHING`,
);
