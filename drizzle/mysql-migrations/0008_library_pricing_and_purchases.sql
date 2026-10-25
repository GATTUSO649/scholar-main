ALTER TABLE `library_resources`
ADD COLUMN `price` decimal(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN `currency` varchar(3) NOT NULL DEFAULT 'KES';
--> statement-breakpoint
CREATE TABLE `library_purchases` (
	`id` varchar(36) NOT NULL,
	`resource_id` varchar(36) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`status` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`phone_number` varchar(20) NOT NULL,
	`merchant_request_id` varchar(100),
	`checkout_request_id` varchar(100),
	`receipt_number` varchar(32),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`paid_at` datetime(3),
	CONSTRAINT `library_purchases_pk` PRIMARY KEY(`id`),
	CONSTRAINT `library_purchases_resource_fk` FOREIGN KEY (`resource_id`) REFERENCES `library_resources`(`id`) ON DELETE CASCADE,
	CONSTRAINT `library_purchases_student_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `library_purchases_checkout_unique` UNIQUE (`checkout_request_id`),
	INDEX `library_purchases_student_status_idx` (`student_id`,`status`),
	INDEX `library_purchases_resource_created_idx` (`resource_id`,`created_at`)
);