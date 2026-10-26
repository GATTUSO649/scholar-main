SET @scholar_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified_at') = 0,
  'ALTER TABLE `users` ADD COLUMN `email_verified_at` datetime(3) NULL',
  'SELECT 1'
);
--> statement-breakpoint
PREPARE scholar_stmt FROM @scholar_ddl;
--> statement-breakpoint
EXECUTE scholar_stmt;
--> statement-breakpoint
DEALLOCATE PREPARE scholar_stmt;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `token_hash` varchar(64) NOT NULL,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`token_hash`),
  INDEX `email_verification_expiry_idx` (`expires_at`),
  CONSTRAINT `email_verification_tokens_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
