ALTER TABLE `users` ADD COLUMN `email_verified_at` datetime(3) NULL;

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `token_hash` varchar(64) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `expires_at` datetime(3) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`token_hash`),
  INDEX `email_verification_expiry_idx` (`expires_at`),
  CONSTRAINT `email_verification_tokens_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
