ALTER TABLE `site_settings`
	ADD COLUMN `business_name` varchar(120) NOT NULL DEFAULT 'ScholarDesk',
	ADD COLUMN `mpesa_till_number` varchar(7) NULL;

ALTER TABLE `library_purchases`
	ADD COLUMN `merchant_shortcode` varchar(7) NULL;