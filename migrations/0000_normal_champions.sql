CREATE TABLE `app_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(100) NOT NULL,
	`description` text,
	`category` text(100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_roles_name_unique` ON `app_roles` (`name`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text(50) NOT NULL,
	`entity_type` text(50) NOT NULL,
	`entity_id` integer,
	`old_values` text,
	`new_values` text,
	`reason` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `discounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(100) NOT NULL,
	`type` text(20) NOT NULL,
	`value` text NOT NULL,
	`is_active` integer DEFAULT true,
	`requires_manager` integer DEFAULT false,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` text NOT NULL,
	`total_price` text NOT NULL,
	`modifications` text,
	`special_instructions` text,
	`is_comped` integer DEFAULT false,
	`comped_by` integer,
	`comp_reason` text,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`comped_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text(20) NOT NULL,
	`customer_name` text DEFAULT 'Walk-in Customer',
	`customer_phone` text(20),
	`customer_email` text(100),
	`subtotal` text NOT NULL,
	`tax` text NOT NULL,
	`tip_amount` text DEFAULT '0.00',
	`discount_amount` text DEFAULT '0.00',
	`total` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`order_type` text(20) DEFAULT 'dine-in',
	`table_number` text(10),
	`notes` text,
	`created_by` integer,
	`managed_by` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`managed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`payment_method` text(20) NOT NULL,
	`amount` text NOT NULL,
	`stripe_payment_id` text,
	`cash_received` text,
	`change_given` text,
	`status` text(20) DEFAULT 'completed',
	`processed_by` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_sizes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`size_name` text(50) NOT NULL,
	`size_label` text(100) NOT NULL,
	`price` text NOT NULL,
	`price_modifier` text DEFAULT '0.00',
	`is_default` integer DEFAULT false,
	`sort_order` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` text NOT NULL,
	`category_id` integer,
	`image_url` text,
	`sku` text NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 5,
	`max_stock` integer DEFAULT 100,
	`is_active` integer DEFAULT true,
	`has_sizes` integer DEFAULT false,
	`allow_modifications` integer DEFAULT true,
	`modification_options` text,
	`item_type` text(20) DEFAULT 'product' NOT NULL,
	`requires_inventory` integer DEFAULT true,
	`taxable` integer DEFAULT true,
	`service_details` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`category` text(50) DEFAULT 'general',
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(50) NOT NULL,
	`rate` text NOT NULL,
	`is_default` integer DEFAULT false,
	`is_active` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `time_clocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`clock_in` integer NOT NULL,
	`clock_out` integer,
	`break_duration` integer DEFAULT 0,
	`total_hours` text,
	`date` integer NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_app_roles` (
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `app_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_code` text(5) NOT NULL,
	`email` text(100),
	`pin_hash` text,
	`first_name` text(50),
	`last_name` text(50),
	`is_active` integer DEFAULT true,
	`hourly_rate` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_employee_code_unique` ON `users` (`employee_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);