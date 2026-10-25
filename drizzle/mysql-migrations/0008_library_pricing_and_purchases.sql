SET @scholar_ddl = IF(
	(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'library_resources' AND column_name = 'price') = 0,
	'ALTER TABLE `library_resources` ADD COLUMN `price` decimal(10,2) NOT NULL DEFAULT 0.00',
	'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF(
	(SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'library_resources' AND column_name = 'currency') = 0,
	'ALTER TABLE `library_resources` ADD COLUMN `currency` varchar(3) NOT NULL DEFAULT ''KES''',
	'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `library_purchases` (
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
	CONSTRAINT `library_purchases_checkout_unique` UNIQUE (`checkout_request_id`),
	INDEX `library_purchases_student_status_idx` (`student_id`,`status`),
	INDEX `library_purchases_resource_created_idx` (`resource_id`,`created_at`)
);
--> statement-breakpoint
SET @scholar_ddl = COALESCE((
	SELECT IF(
		child.character_set_name <=> parent.character_set_name AND child.collation_name <=> parent.collation_name,
		'SELECT 1',
		CONCAT('ALTER TABLE `library_purchases` MODIFY COLUMN `resource_id` varchar(36) CHARACTER SET ', parent.character_set_name, ' COLLATE ', parent.collation_name, ' NOT NULL')
	)
	FROM information_schema.columns AS child
	JOIN information_schema.columns AS parent
		ON parent.table_schema = DATABASE() AND parent.table_name = 'library_resources' AND parent.column_name = 'id'
	WHERE child.table_schema = DATABASE() AND child.table_name = 'library_purchases' AND child.column_name = 'resource_id'
), 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = COALESCE((
	SELECT IF(
		child.character_set_name <=> parent.character_set_name AND child.collation_name <=> parent.collation_name,
		'SELECT 1',
		CONCAT('ALTER TABLE `library_purchases` MODIFY COLUMN `student_id` varchar(36) CHARACTER SET ', parent.character_set_name, ' COLLATE ', parent.collation_name, ' NOT NULL')
	)
	FROM information_schema.columns AS child
	JOIN information_schema.columns AS parent
		ON parent.table_schema = DATABASE() AND parent.table_name = 'users' AND parent.column_name = 'id'
	WHERE child.table_schema = DATABASE() AND child.table_name = 'library_purchases' AND child.column_name = 'student_id'
), 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF(
	(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'library_purchases' AND constraint_name = 'library_purchases_resource_fk') = 0,
	'ALTER TABLE `library_purchases` ADD CONSTRAINT `library_purchases_resource_fk` FOREIGN KEY (`resource_id`) REFERENCES `library_resources`(`id`) ON DELETE CASCADE',
	'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF(
	(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'library_purchases' AND constraint_name = 'library_purchases_student_fk') = 0,
	'ALTER TABLE `library_purchases` ADD CONSTRAINT `library_purchases_student_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE CASCADE',
	'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;