UPDATE services
SET name = 'Proofreading',
	description = 'Grammar, clarity, flow and style improvements to your own writing.',
	active = true
WHERE id = '4e52ab27-521f-4e18-a6bd-0d567461b002';
--> statement-breakpoint
UPDATE services
SET name = 'Research Proposal',
	description = 'Guidance on proposal structure, research questions, methods and feedback on your draft.',
	active = true
WHERE id = '4e52ab27-521f-4e18-a6bd-0d567461b003';
--> statement-breakpoint
UPDATE services
SET name = 'Originality & AI Policy Review',
	description = 'Review similarity reports, citation practices and institutional AI-use disclosure requirements.',
	active = true
WHERE id = '4e52ab27-521f-4e18-a6bd-0d567461b008';
--> statement-breakpoint
UPDATE services
SET name = 'Project Guidance',
	description = 'Guidance on project planning, milestones, requirements and reviewing your own work.',
	active = true
WHERE id = '4e52ab27-521f-4e18-a6bd-0d567461b009';
--> statement-breakpoint
INSERT INTO services (id, name, description, base_price, currency, unit, active, sort)
VALUES (
	'4e52ab27-521f-4e18-a6bd-0d567461b010',
	'Practicum Typing',
	'Accurate typing and formatting of your practicum report from your notes or draft.',
	0,
	'KES',
	'price on request',
	true,
	10
)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	active = EXCLUDED.active,
	sort = EXCLUDED.sort;