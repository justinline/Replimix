CREATE TABLE IF NOT EXISTS "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"sender" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"ord" integer NOT NULL,
	"deleted" boolean NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "replicache_client" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"client_group_id" varchar(36) NOT NULL,
	"last_mutation_id" integer NOT NULL,
	"version" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "replicache_server" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer
);
