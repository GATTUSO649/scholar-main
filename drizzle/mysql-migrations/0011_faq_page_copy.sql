SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'faq_title') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `faq_title` varchar(160) NOT NULL DEFAULT ''Frequently asked questions''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'faq_intro') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `faq_intro` varchar(500) NOT NULL DEFAULT ''Answers to common questions about ScholarDesk services, payments and privacy.''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;