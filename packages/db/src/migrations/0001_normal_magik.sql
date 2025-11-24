CREATE TABLE `adopsiak_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_or_municipality` text NOT NULL,
	`shipping_address` text NOT NULL,
	`delegate_name` text NOT NULL,
	`delegate_phone1` text NOT NULL,
	`delegate_phone2` text,
	`libraries_count` integer DEFAULT 0 NOT NULL,
	`kindergartens_count` integer DEFAULT 0 NOT NULL,
	`total_institutions` integer DEFAULT 0 NOT NULL,
	`delivery_date` text,
	`protocol_text` text,
	`protocol_email_recipient` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `oauth_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text,
	`access_token_expires_at` integer NOT NULL,
	`refresh_token_expires_at` integer NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_application`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_token_access_token_unique` ON `oauth_access_token` (`access_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_access_token_refresh_token_unique` ON `oauth_access_token` (`refresh_token`);--> statement-breakpoint
CREATE TABLE `oauth_application` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text,
	`metadata` text,
	`client_id` text NOT NULL,
	`client_secret` text,
	`redirect_urls` text NOT NULL,
	`type` text NOT NULL,
	`disabled` integer,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `oauth_application_client_id_unique` ON `oauth_application` (`client_id`);--> statement-breakpoint
CREATE TABLE `oauth_consent` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`user_id` text NOT NULL,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`consent_given` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_application`(`client_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
