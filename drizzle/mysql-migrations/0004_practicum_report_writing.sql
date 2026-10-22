INSERT INTO `services` (`id`, `name`, `description`, `base_price`, `currency`, `unit`, `active`, `sort`)
SELECT '4e52ab27-521f-4e18-a6bd-0d567461b010', 'Practicum Report Writing', 'Guidance with planning, structuring and refining your practicum report.', 0.00, 'KES', 'price on request', true, 10
WHERE NOT EXISTS (
	SELECT 1 FROM `services` WHERE `name` = 'Practicum Report Writing'
);