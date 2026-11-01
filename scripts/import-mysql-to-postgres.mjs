import mysql from "mysql2/promise";
import postgres from "postgres";

const tables = [
  { name: "users", key: "id" },
  { name: "profiles", key: "id" },
  { name: "user_roles", key: "id" },
  { name: "sessions", key: "token_hash" },
  { name: "password_reset_tokens", key: "token_hash" },
  { name: "email_verification_tokens", key: "token_hash" },
  { name: "login_attempts", key: "email" },
  { name: "services", key: "id" },
  { name: "requests", key: "id" },
  { name: "request_updates", key: "id" },
  { name: "request_files", key: "id" },
  { name: "library_resources", key: "id" },
  { name: "library_purchases", key: "id" },
  { name: "faq_entries", key: "id" },
  { name: "site_settings", key: "id" },
  { name: "notifications", key: "id" },
];

const foreignKeys = [
  ["profiles", "id", "users", "id"],
  ["user_roles", "user_id", "users", "id"],
  ["sessions", "user_id", "users", "id"],
  ["password_reset_tokens", "user_id", "users", "id"],
  ["email_verification_tokens", "user_id", "users", "id"],
  ["requests", "student_id", "users", "id"],
  ["requests", "service_id", "services", "id"],
  ["requests", "graded_by", "users", "id"],
  ["request_updates", "request_id", "requests", "id"],
  ["request_updates", "created_by", "users", "id"],
  ["request_files", "request_id", "requests", "id"],
  ["request_files", "uploaded_by", "users", "id"],
  ["library_resources", "uploaded_by", "users", "id"],
  ["library_purchases", "resource_id", "library_resources", "id"],
  ["library_purchases", "student_id", "users", "id"],
  ["notifications", "user_id", "users", "id"],
  ["notifications", "request_id", "requests", "id"],
];

const batchSize = 250;
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const resume = args.has("--resume");

function quoteIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unexpected database identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function canonical(value) {
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(value)
  ) {
    return new Date(`${value.replace(" ", "T")}Z`).toISOString();
  }
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonical(nested)]),
    );
  }
  return value;
}

function sameRow(left, right, columns) {
  return columns.every(
    (column) =>
      JSON.stringify(canonical(left[column])) === JSON.stringify(canonical(right[column])),
  );
}

async function countRows(connection, table) {
  const [rows] = await connection.unsafe(
    `SELECT count(*)::int AS count FROM ${quoteIdentifier(table)}`,
  );
  return Number(rows.count);
}

async function verifySchema(source, target) {
  for (const { name } of tables) {
    const [sourceColumns] = await source.query(`SHOW COLUMNS FROM \`${name}\``);
    const targetColumns = await target`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${name}
      ORDER BY ordinal_position
    `;
    const sourceNames = sourceColumns.map(({ Field }) => Field).sort();
    const targetNames = targetColumns.map(({ column_name: columnName }) => columnName).sort();
    if (JSON.stringify(sourceNames) !== JSON.stringify(targetNames)) {
      throw new Error(
        `Column mismatch for ${name}; apply the PostgreSQL baseline and review schema differences.`,
      );
    }
  }
}

async function sourceRows(source, table, key, cursor) {
  const escapedTable = `\`${table}\``;
  const escapedKey = `\`${key}\``;
  if (cursor === undefined) {
    return source.query(`SELECT * FROM ${escapedTable} ORDER BY ${escapedKey} LIMIT ?`, [
      batchSize,
    ]);
  }
  return source.query(
    `SELECT * FROM ${escapedTable} WHERE ${escapedKey} > ? ORDER BY ${escapedKey} LIMIT ?`,
    [cursor, batchSize],
  );
}

async function insertBatch(target, table, key, rows) {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const quotedColumns = columns.map(quoteIdentifier).join(", ");
  const placeholders = rows
    .map((_, rowIndex) => {
      const start = rowIndex * columns.length;
      return `(${columns.map((__, columnIndex) => `$${start + columnIndex + 1}`).join(", ")})`;
    })
    .join(", ");
  const values = rows.flatMap((row) => columns.map((column) => row[column]));
  const keyColumn = quoteIdentifier(key);
  const inserted = await target.unsafe(
    `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES ${placeholders} ON CONFLICT (${keyColumn}) DO NOTHING RETURNING ${keyColumn}`,
    values,
  );
  if (inserted.length === rows.length) return;

  const insertedKeys = new Set(inserted.map((row) => String(row[key])));
  for (const row of rows) {
    if (insertedKeys.has(String(row[key]))) continue;
    const [existing] = await target.unsafe(
      `SELECT * FROM ${quoteIdentifier(table)} WHERE ${keyColumn} = $1 LIMIT 1`,
      [row[key]],
    );
    if (!existing || !sameRow(row, existing, columns)) {
      throw new Error(
        `Conflicting destination row in ${table} (${key}=${row[key]}). No row was overwritten.`,
      );
    }
  }
}

async function verifyForeignKeys(target) {
  const results = [];
  for (const [child, childKey, parent, parentKey] of foreignKeys) {
    const [result] = await target.unsafe(
      `SELECT count(*)::int AS count FROM ${quoteIdentifier(child)} child ` +
        `LEFT JOIN ${quoteIdentifier(parent)} parent ON child.${quoteIdentifier(childKey)} = parent.${quoteIdentifier(parentKey)} ` +
        `WHERE child.${quoteIdentifier(childKey)} IS NOT NULL AND parent.${quoteIdentifier(parentKey)} IS NULL`,
    );
    const orphans = Number(result.count);
    results.push({ relation: `${child}.${childKey} -> ${parent}.${parentKey}`, orphans });
    if (orphans !== 0) throw new Error(`Found ${orphans} orphan rows in ${child}.${childKey}.`);
  }
  return results;
}

async function main() {
  for (const argument of args) {
    if (argument !== "--dry-run" && argument !== "--resume") {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (!process.env.MYSQL_SOURCE_URL || !process.env.DATABASE_URL) {
    throw new Error(
      "Set MYSQL_SOURCE_URL and DATABASE_URL. These URLs are read only from the server environment.",
    );
  }
  const source = await mysql.createConnection({
    uri: process.env.MYSQL_SOURCE_URL,
    dateStrings: true,
  });
  const target = postgres(process.env.DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    prepare: false,
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  });

  try {
    await source.query("SET time_zone = '+00:00'");
    await verifySchema(source, target);
    const sourceCounts = {};
    const targetCounts = {};
    for (const { name } of tables) {
      const [[row]] = await source.query(`SELECT count(*) AS count FROM \`${name}\``);
      sourceCounts[name] = Number(row.count);
      targetCounts[name] = await countRows(target, name);
    }
    const hasDestinationData = Object.values(targetCounts).some((count) => count > 0);
    if (hasDestinationData && !resume && !dryRun) {
      throw new Error(
        "Destination is not empty. Refusing to import; inspect it or rerun with --resume after backup.",
      );
    }
    if (dryRun) {
      console.log(JSON.stringify({ mode: "dry-run", sourceCounts, targetCounts }, null, 2));
      return;
    }

    for (const { name, key } of tables) {
      let cursor;
      while (true) {
        const [rows] = await sourceRows(source, name, key, cursor);
        if (rows.length === 0) break;
        await insertBatch(target, name, key, rows);
        cursor = rows.at(-1)[key];
      }
      console.log(`Copied ${name}: ${sourceCounts[name]} source rows`);
    }

    const verifiedCounts = {};
    for (const { name } of tables) {
      verifiedCounts[name] = await countRows(target, name);
      if (verifiedCounts[name] !== sourceCounts[name]) {
        throw new Error(
          `Count mismatch for ${name}: MySQL=${sourceCounts[name]}, PostgreSQL=${verifiedCounts[name]}.`,
        );
      }
    }
    const verifiedForeignKeys = await verifyForeignKeys(target);
    const roleCounts = await target`
      SELECT role, count(*)::int AS count FROM user_roles GROUP BY role ORDER BY role
    `;
    const requestCounts = await target`
      SELECT status, payment_status, count(*)::int AS count
      FROM requests GROUP BY status, payment_status ORDER BY status, payment_status
    `;
    const purchaseCounts = await target`
      SELECT status, count(*)::int AS count
      FROM library_purchases GROUP BY status ORDER BY status
    `;
    console.log(
      JSON.stringify(
        {
          mode: resume ? "resume" : "import",
          verifiedCounts,
          verifiedForeignKeys,
          roleCounts,
          requestCounts,
          purchaseCounts,
        },
        null,
        2,
      ),
    );
  } finally {
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Data import failed.");
  process.exitCode = 1;
});
