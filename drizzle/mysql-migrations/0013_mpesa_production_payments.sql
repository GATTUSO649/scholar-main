ALTER TABLE `library_purchases`
	ADD COLUMN `payment_method` varchar(20) NOT NULL DEFAULT 'mpesa',
	ADD COLUMN `account_reference` varchar(12) NULL,
	ADD COLUMN `transaction_timestamp` datetime(3) NULL,
	ADD COLUMN `callback_response` json NULL,
	ADD COLUMN `failure_reason` varchar(255) NULL,
	ADD COLUMN `updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
	ADD CONSTRAINT `library_purchases_merchant_unique` UNIQUE (`merchant_request_id`),
	ADD CONSTRAINT `library_purchases_receipt_unique` UNIQUE (`receipt_number`),
	ADD INDEX `library_purchases_status_created_idx` (`status`, `created_at`);