ALTER TABLE `requests`
MODIFY COLUMN `status` enum('submitted','under_review','quoted','awaiting_payment','in_progress','completed','declined','cancelled') NOT NULL DEFAULT 'submitted';
--> statement-breakpoint
ALTER TABLE `request_updates`
MODIFY COLUMN `status` enum('submitted','under_review','quoted','awaiting_payment','in_progress','completed','declined','cancelled');
