import { boolean, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const replicache_server = pgTable("replicache_server", {
  id: integer("id").primaryKey().notNull(),
  version: integer("version"),
});

export const message = pgTable("messages", {
  id: text("id").primaryKey().notNull(),
  sender: varchar("sender", { length: 255 }).notNull(),
  content: text("content").notNull(),
  ord: integer("ord").notNull(),
  deleted: boolean("deleted").notNull(),
  version: integer("version").notNull(),
});

export const replicache_client = pgTable("replicache_client", {
  id: varchar("id", { length: 36 }).primaryKey().notNull(),
  client_group_id: varchar("client_group_id", { length: 36 }).notNull(),
  last_mutation_id: integer("last_mutation_id").notNull(),
  version: integer("version").notNull(),
});
