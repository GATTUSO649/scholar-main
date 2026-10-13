CREATE TABLE `login_attempts` (
	`email` varchar(255) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`window_started_at` datetime(3) NOT NULL,
	CONSTRAINT `login_attempts_email` PRIMARY KEY(`email`)
);
--> statement-breakpoint
CREATE TABLE `password_reset_tokens` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `password_reset_tokens_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` varchar(36) NOT NULL,
	`full_name` varchar(100) NOT NULL DEFAULT '',
	`reg_number` varchar(50),
	`email` varchar(255),
	`phone` varchar(40),
	`country` varchar(60),
	`institution` varchar(120),
	`course` varchar(120),
	`year_of_study` varchar(20),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_files` (
	`id` varchar(36) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`uploaded_by` varchar(36) NOT NULL,
	`storage_key` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`mime_type` varchar(120) NOT NULL,
	`size` int NOT NULL,
	`kind` enum('submission','delivery') NOT NULL DEFAULT 'submission',
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `request_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `request_files_storage_key_unique` UNIQUE(`storage_key`)
);
--> statement-breakpoint
CREATE TABLE `request_updates` (
	`id` varchar(36) NOT NULL,
	`request_id` varchar(36) NOT NULL,
	`status` enum('submitted','under_review','quoted','awaiting_payment','in_progress','completed','cancelled'),
	`note` text,
	`created_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `request_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requests` (
	`id` varchar(36) NOT NULL,
	`ref` varchar(20) NOT NULL,
	`student_id` varchar(36) NOT NULL,
	`service_id` varchar(36),
	`title` varchar(200) NOT NULL,
	`course_unit` varchar(120),
	`lecturer` varchar(120),
	`description` text NOT NULL,
	`num_questions` int,
	`num_pages` int,
	`academic_level` varchar(60),
	`deadline` datetime(3),
	`preferred_date` datetime(3),
	`status` enum('submitted','under_review','quoted','awaiting_payment','in_progress','completed','cancelled') NOT NULL DEFAULT 'submitted',
	`payment_status` enum('unpaid','pending','paid','refunded') NOT NULL DEFAULT 'unpaid',
	`price` decimal(10,2),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`admin_notes` text,
	`grade` varchar(20),
	`admin_feedback` text,
	`graded_at` datetime(3),
	`graded_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `requests_ref_unique` UNIQUE(`ref`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`base_price` decimal(10,2) NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'KES',
	`unit` varchar(40) NOT NULL DEFAULT 'per page',
	`active` boolean NOT NULL DEFAULT true,
	`sort` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` int NOT NULL DEFAULT 1,
	`show_prices` boolean NOT NULL DEFAULT true,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `site_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` enum('admin','student') NOT NULL DEFAULT 'student',
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_user_role_unique` UNIQUE(`user_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_users_id_fk` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_files` ADD CONSTRAINT `request_files_request_id_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_files` ADD CONSTRAINT `request_files_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_updates` ADD CONSTRAINT `request_updates_request_id_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_updates` ADD CONSTRAINT `request_updates_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requests` ADD CONSTRAINT `requests_student_id_users_id_fk` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requests` ADD CONSTRAINT `requests_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requests` ADD CONSTRAINT `requests_graded_by_users_id_fk` FOREIGN KEY (`graded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `password_reset_expiry_idx` ON `password_reset_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `request_files_request_created_idx` ON `request_files` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `request_updates_request_created_idx` ON `request_updates` (`request_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_student_created_idx` ON `requests` (`student_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_status_idx` ON `requests` (`status`);--> statement-breakpoint
CREATE INDEX `services_active_sort_idx` ON `services` (`active`,`sort`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry_idx` ON `sessions` (`expires_at`);--> statement-breakpoint
INSERT INTO `services` (`id`, `name`, `description`, `base_price`, `currency`, `unit`, `active`, `sort`) VALUES
('4e52ab27-521f-4e18-a6bd-0d567461b001', 'Tutoring Session', 'One-on-one guidance to help you understand difficult topics.', 15.00, 'KES', 'per hour', false, 1),
('4e52ab27-521f-4e18-a6bd-0d567461b002', 'Proofreading & Editing', 'Grammar, clarity, flow and style improvements to your own writing.', 4.00, 'KES', 'per page', true, 2),
('4e52ab27-521f-4e18-a6bd-0d567461b003', 'Research Guidance', 'Help finding credible sources and structuring your research.', 8.00, 'KES', 'per page', true, 3),
('4e52ab27-521f-4e18-a6bd-0d567461b004', 'Formatting & Referencing', 'APA, MLA, Harvard and Chicago formatting and citations.', 3.00, 'KES', 'per page', false, 4),
('4e52ab27-521f-4e18-a6bd-0d567461b005', 'Assignment Review', 'Detailed feedback on your draft before you submit.', 6.00, 'KES', 'per page', true, 5),
('4e52ab27-521f-4e18-a6bd-0d567461b006', 'Presentation Support', 'Slide design and structure feedback for your presentation.', 5.00, 'KES', 'per slide', false, 6),
('4e52ab27-521f-4e18-a6bd-0d567461b007', 'Assignment Typing', 'Clean, correctly formatted typing of handwritten notes, PDFs or scans.', 2.00, 'KES', 'per page', true, 7),
('4e52ab27-521f-4e18-a6bd-0d567461b008', 'Plagiarism Check & Removal', 'A similarity scan of your draft, then rewriting of flagged passages.', 3.00, 'KES', 'per page', true, 8),
('4e52ab27-521f-4e18-a6bd-0d567461b009', 'Project Task', 'Help planning and completing a project or group task.', 0.00, 'KES', 'price on request', true, 9);
--> statement-breakpoint
INSERT INTO `site_settings` (`id`, `show_prices`) VALUES (1, true);