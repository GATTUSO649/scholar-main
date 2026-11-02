import postgres from "postgres";

const services = [
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b001",
    "Tutoring Session",
    "One-on-one guidance to help you understand difficult topics.",
    15,
    "KES",
    "per hour",
    false,
    1,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b002",
    "Proofreading",
    "Grammar, clarity, flow and style improvements to your own writing.",
    4,
    "KES",
    "per page",
    true,
    2,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b003",
    "Research Proposal",
    "Guidance on proposal structure, research questions, methods and feedback on your draft.",
    8,
    "KES",
    "per page",
    true,
    3,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b004",
    "Formatting & Referencing",
    "APA, MLA, Harvard and Chicago formatting and citations.",
    3,
    "KES",
    "per page",
    false,
    4,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b005",
    "Assignment Review",
    "Detailed feedback on your draft before you submit.",
    6,
    "KES",
    "per page",
    true,
    5,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b006",
    "Presentation Support",
    "Slide design and structure feedback for your presentation.",
    5,
    "KES",
    "per slide",
    false,
    6,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b007",
    "Assignment Typing",
    "Clean, correctly formatted typing of handwritten notes, PDFs or scans.",
    2,
    "KES",
    "per page",
    true,
    7,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b008",
    "Originality & AI Policy Review",
    "Review similarity reports, citation practices and institutional AI-use disclosure requirements.",
    3,
    "KES",
    "per page",
    true,
    8,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b009",
    "Project Guidance",
    "Guidance on project planning, milestones, requirements and reviewing your own work.",
    0,
    "KES",
    "price on request",
    true,
    9,
  ],
  [
    "4e52ab27-521f-4e18-a6bd-0d567461b010",
    "Practicum Typing",
    "Accurate typing and formatting of your practicum report from your notes or draft.",
    0,
    "KES",
    "price on request",
    true,
    10,
  ],
];

if (!process.env.DATABASE_URL) {
  throw new Error("Set DATABASE_URL to the PostgreSQL database to seed.");
}

const database = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 10,
  prepare: false,
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
});

try {
  await database.begin(async (transaction) => {
    for (const [id, name, description, basePrice, currency, unit, active, sort] of services) {
      await transaction`
        INSERT INTO services (id, name, description, base_price, currency, unit, active, sort)
        VALUES (${id}, ${name}, ${description}, ${basePrice}, ${currency}, ${unit}, ${active}, ${sort})
        ON CONFLICT (id) DO NOTHING
      `;
    }
    await transaction`
      INSERT INTO site_settings (id, show_prices)
      VALUES (1, true)
      ON CONFLICT (id) DO NOTHING
    `;
  });
  console.log(
    "Inserted missing default service catalog and site settings; existing rows were not changed.",
  );
} finally {
  await database.end();
}
