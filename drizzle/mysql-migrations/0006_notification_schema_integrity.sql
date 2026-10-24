SET @scholar_ddl = COALESCE((
	SELECT IF(
		child.character_set_name <=> parent.character_set_name AND child.collation_name <=> parent.collation_name,
		'SELECT 1',
		CONCAT('ALTER TABLE `notifications` MODIFY COLUMN `user_id` varchar(36) CHARACTER SET ', parent.character_set_name, ' COLLATE ', parent.collation_name, ' NOT NULL')
	)
	FROM information_schema.columns AS child
	JOIN information_schema.columns AS parent
		ON parent.table_schema = DATABASE() AND parent.table_name = 'users' AND parent.column_name = 'id'
	WHERE child.table_schema = DATABASE() AND child.table_name = 'notifications' AND child.column_name = 'user_id'
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
		CONCAT('ALTER TABLE `notifications` MODIFY COLUMN `request_id` varchar(36) CHARACTER SET ', parent.character_set_name, ' COLLATE ', parent.collation_name, ' NULL')
	)
	FROM information_schema.columns AS child
	JOIN information_schema.columns AS parent
		ON parent.table_schema = DATABASE() AND parent.table_name = 'requests' AND parent.column_name = 'id'
	WHERE child.table_schema = DATABASE() AND child.table_name = 'notifications' AND child.column_name = 'request_id'
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
		CONCAT('ALTER TABLE `library_resources` MODIFY COLUMN `uploaded_by` varchar(36) CHARACTER SET ', parent.character_set_name, ' COLLATE ', parent.collation_name, ' NOT NULL')
	)
	FROM information_schema.columns AS child
	JOIN information_schema.columns AS parent
		ON parent.table_schema = DATABASE() AND parent.table_name = 'users' AND parent.column_name = 'id'
	WHERE child.table_schema = DATABASE() AND child.table_name = 'library_resources' AND child.column_name = 'uploaded_by'
), 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF(
	(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'notifications' AND constraint_name = 'notifications_user_id_users_id_fk') = 0,
	'ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action',
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
	(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'notifications' AND constraint_name = 'notifications_request_id_requests_id_fk') = 0,
	'ALTER TABLE `notifications` ADD CONSTRAINT `notifications_request_id_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE set null ON UPDATE no action',
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
	(SELECT COUNT(*) FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE() AND table_name = 'library_resources' AND constraint_name = 'library_resources_uploaded_by_users_id_fk') = 0,
	'ALTER TABLE `library_resources` ADD CONSTRAINT `library_resources_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action',
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
	(SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'notifications_user_created_idx') = 0,
	'CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`,`created_at`)',
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
	(SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'notifications' AND index_name = 'notifications_user_read_created_idx') = 0,
	'CREATE INDEX `notifications_user_read_created_idx` ON `notifications` (`user_id`,`read_at`,`created_at`)',
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
	(SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'library_resources' AND index_name = 'library_resources_category_created_idx') = 0,
	'CREATE INDEX `library_resources_category_created_idx` ON `library_resources` (`category`,`created_at`)',
	'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
