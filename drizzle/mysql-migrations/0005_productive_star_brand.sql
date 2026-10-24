CREATE TABLE IF NOT EXISTS `library_resources` (
	`id` varchar(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`category` enum('novel','business_plan','article') NOT NULL,
	`storage_key` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`size` int NOT NULL,
	`uploaded_by` varchar(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `library_resources_id` PRIMARY KEY(`id`),
	CONSTRAINT `library_resources_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE INDEX `library_resources_category_created_idx` ON `library_resources` (`category`,`created_at`);