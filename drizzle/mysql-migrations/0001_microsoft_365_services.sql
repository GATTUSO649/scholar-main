UPDATE `services`
SET `active` = true
WHERE `name` IN ('Tutoring Session', 'Formatting & Referencing', 'Presentation Support');

INSERT INTO `services` (`id`, `name`, `description`, `base_price`, `currency`, `unit`, `active`, `sort`) VALUES
('d0a432a1-6212-4ea2-8ce1-3f124b8c1001', 'Microsoft Word', 'Help with document formatting, styles, page layout, references, templates and accessibility.', 0.00, 'KES', 'price on request', true, 20),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1002', 'Microsoft Excel', 'Guidance with formulas, charts, pivot tables, spreadsheet cleanup and workbook setup.', 0.00, 'KES', 'price on request', true, 21),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1003', 'Microsoft PowerPoint', 'Support with slide formatting, charts, speaker notes and accessible presentations.', 0.00, 'KES', 'price on request', true, 22),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1004', 'Microsoft Outlook', 'Help setting up email, calendars, contacts, rules and organized academic workflows.', 0.00, 'KES', 'price on request', true, 23),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1005', 'Microsoft Teams', 'Support with meetings, class or project workspaces, channels and file collaboration.', 0.00, 'KES', 'price on request', true, 24),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1006', 'Microsoft OneDrive', 'Help with cloud storage setup, file synchronization, organization and sharing permissions.', 0.00, 'KES', 'price on request', true, 25),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1007', 'Microsoft OneNote', 'Support organizing digital notes, notebooks, class materials and collaborative notebooks.', 0.00, 'KES', 'price on request', true, 26),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1008', 'Microsoft Forms', 'Guidance creating surveys, quizzes, registration forms and feedback forms.', 0.00, 'KES', 'price on request', true, 27),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1009', 'Microsoft SharePoint', 'Help with SharePoint sites, document libraries, lists and access configuration.', 0.00, 'KES', 'price on request', true, 28),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1010', 'Microsoft Access', 'Guidance with relational database design, tables, queries, forms and reports.', 0.00, 'KES', 'price on request', true, 29),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1011', 'Microsoft Planner', 'Help organizing tasks, plans, assignments and collaboration with Microsoft Planner.', 0.00, 'KES', 'price on request', true, 30),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1012', 'Microsoft Project', 'Guidance with project plans, timelines, task dependencies and progress tracking.', 0.00, 'KES', 'price on request', true, 31),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1013', 'Microsoft Visio', 'Support creating and formatting flowcharts, diagrams and process maps.', 0.00, 'KES', 'price on request', true, 32),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1014', 'Microsoft Loop', 'Help setting up shared workspaces, pages and collaborative project components.', 0.00, 'KES', 'price on request', true, 33),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1015', 'Microsoft Sway', 'Support creating and presenting accessible interactive reports and stories.', 0.00, 'KES', 'price on request', true, 34),
('d0a432a1-6212-4ea2-8ce1-3f124b8c1016', 'Microsoft 365 Setup & Support', 'Help installing and configuring Microsoft 365 apps, accounts and supported devices.', 0.00, 'KES', 'price on request', true, 35);
