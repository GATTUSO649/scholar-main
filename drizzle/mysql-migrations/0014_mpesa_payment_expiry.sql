ALTER TABLE `library_purchases`
	ADD COLUMN `expires_at` datetime(3) NULL;

UPDATE `library_purchases`
SET `expires_at` = DATE_ADD(`updated_at`, INTERVAL 60 SECOND)
WHERE `status` = 'pending';