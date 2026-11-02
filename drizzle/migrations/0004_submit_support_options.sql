INSERT INTO services (id, name, description, base_price, currency, unit, active, sort)
VALUES
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b002',
		'Proofreading',
		'Grammar, clarity, flow and style improvements to your own writing.',
		4,
		'KES',
		'per page',
		true,
		2
	),
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b010',
		'Practicum Typing',
		'Accurate typing and formatting of your practicum report from your notes or draft.',
		0,
		'KES',
		'price on request',
		true,
		3
	),
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b007',
		'Assignment Typing',
		'Clean, correctly formatted typing of handwritten notes, PDFs or scans.',
		2,
		'KES',
		'per page',
		true,
		4
	),
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b003',
		'Research Proposal',
		'Guidance on proposal structure, research questions, methods and feedback on your draft.',
		8,
		'KES',
		'per page',
		true,
		5
	),
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b009',
		'Project Guidance',
		'Guidance on project planning, milestones, requirements and reviewing your own work.',
		0,
		'KES',
		'price on request',
		true,
		6
	),
	(
		'4e52ab27-521f-4e18-a6bd-0d567461b008',
		'Originality & AI Policy Review',
		'Review similarity reports, citation practices and institutional AI-use disclosure requirements.',
		3,
		'KES',
		'per page',
		true,
		7
	)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	active = EXCLUDED.active,
	sort = EXCLUDED.sort;