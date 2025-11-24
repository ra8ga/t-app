PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0000_initial.sql','2025-11-23 20:56:42');
CREATE TABLE `account` (
    `id` text PRIMARY KEY NOT NULL,
    `account_id` text NOT NULL,
    `provider_id` text NOT NULL,
    `user_id` text NOT NULL,
    `access_token` text,
    `refresh_token` text,
    `id_token` text,
    `access_token_expires_at` integer,
    `refresh_token_expires_at` integer,
    `scope` text,
    `password` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `session` (
    `id` text PRIMARY KEY NOT NULL,
    `expires_at` integer NOT NULL,
    `token` text NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `ip_address` text,
    `user_agent` text,
    `user_id` text NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `user` (
    `id` text PRIMARY KEY NOT NULL,
    `name` text NOT NULL,
    `email` text NOT NULL,
    `email_verified` integer NOT NULL,
    `image` text,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL
);
CREATE TABLE `verification` (
    `id` text PRIMARY KEY NOT NULL,
    `identifier` text NOT NULL,
    `value` text NOT NULL,
    `expires_at` integer NOT NULL,
    `created_at` integer,
    `updated_at` integer
);
CREATE TABLE `todo` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `text` text NOT NULL,
    `completed` integer DEFAULT false NOT NULL
);
INSERT INTO "todo" VALUES(1,'test',0);
INSERT INTO "todo" VALUES(2,'test2',0);
INSERT INTO "todo" VALUES(3,'test3',0);
INSERT INTO "todo" VALUES(4,'xxxxx',1);
INSERT INTO "todo" VALUES(5,'zzzzz',0);
INSERT INTO "todo" VALUES(6,'rrrrr',0);
INSERT INTO "todo" VALUES(7,'dddddd',0);
INSERT INTO "todo" VALUES(8,'ffff',0);
INSERT INTO "todo" VALUES(9,'ttttt',0);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',1);
INSERT INTO "sqlite_sequence" VALUES('todo',9);
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);