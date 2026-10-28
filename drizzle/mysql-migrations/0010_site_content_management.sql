CREATE TABLE IF NOT EXISTS `faq_entries` (
	`id` varchar(36) NOT NULL,
	`question` varchar(300) NOT NULL,
	`answer` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `faq_entries_id` PRIMARY KEY(`id`),
	INDEX `faq_entries_active_sort_idx` (`active`, `sort`)
);
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'contact_email') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `contact_email` varchar(255) NOT NULL DEFAULT ''support@scholardesk.app''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'contact_phone') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `contact_phone` varchar(40) NOT NULL DEFAULT ''+254 700 000 000''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'contact_whatsapp') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `contact_whatsapp` varchar(40) NOT NULL DEFAULT ''''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'support_hours') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `support_hours` varchar(120) NOT NULL DEFAULT ''Mon-Sat, 8:00-20:00 EAT''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
SET @scholar_ddl = IF((SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'site_settings' AND column_name = 'footer_message') = 0, 'ALTER TABLE `site_settings` ADD COLUMN `footer_message` varchar(255) NOT NULL DEFAULT ''Thoughtful academic support, from first draft to final submission.''', 'SELECT 1');
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint
INSERT IGNORE INTO `faq_entries` (`id`, `question`, `answer`, `active`, `sort`) VALUES
	('00000000-0000-4000-8000-000000000001', 'What kind of support do you offer?', 'Assignment typing, proofreading, plagiarism checks, project tasks, research guidance and draft reviews. You choose only what you need.', true, 0),
	('00000000-0000-4000-8000-000000000002', 'How is the price calculated?', 'Each service has a base rate. Urgent deadlines and complexity may adjust the final quote, which you approve before paying.', true, 1),
	('00000000-0000-4000-8000-000000000003', 'Which payment methods are accepted?', 'M-Pesa for students in Kenya, plus Visa, Mastercard and other international methods in KES, USD, GBP and EUR.', true, 2),
	('00000000-0000-4000-8000-000000000004', 'Are my files private?', 'Files are stored privately and only you and our support team can access them.', true, 3),
	('00000000-0000-4000-8000-000000000005', 'Can I track my request?', 'Every request has a live status timeline in your dashboard, from submission to completion.', true, 4);
--> statement-breakpoint
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
