import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, resolveMigrationDatabaseUrl } from "@/lib/database.server";

describe("Database environment configuration", () => {
  it("prefers DATABASE_URL when it is set", () => {
    expect(
      resolveDatabaseUrl({
        DATABASE_URL: "postgres://app:secret@db.example:5432/scholar_desk",
        POSTGRES_URL: "postgres://ignored:secret@ignored.example:5432/ignored",
        PGHOST: "ignored.example",
        PGUSER: "ignored",
        PGDATABASE: "ignored",
      }),
    ).toBe("postgres://app:secret@db.example:5432/scholar_desk");
  });

  it("builds a URL from Supabase/Postgres variables", () => {
    const url = new URL(
      resolveDatabaseUrl({
        PGHOST: "db.supabase.co",
        PGPORT: "5432",
        PGUSER: "app_user",
        PGPASSWORD: "p@ss:word",
        PGDATABASE: "postgres",
      }),
    );

    expect(url.hostname).toBe("db.supabase.co");
    expect(url.port).toBe("5432");
    expect(decodeURIComponent(url.username)).toBe("app_user");
    expect(decodeURIComponent(url.password)).toBe("p@ss:word");
    expect(url.pathname).toBe("/postgres");
  });

  it("supports DATABASE_URL and Postgres-specific aliases", () => {
    const url = new URL(
      resolveDatabaseUrl({
        PGHOST: "localhost",
        PGUSER: "postgres",
        POSTGRES_PASSWORD: "local-secret",
        POSTGRES_DB: "scholar_desk",
      }),
    );

    expect(url.port).toBe("5432");
    expect(url.password).toBe("local-secret");
    expect(url.pathname).toBe("/scholar_desk");
  });

  it("trims whitespace from configured connection values", () => {
    const url = new URL(
      resolveDatabaseUrl({
        PGHOST: "  localhost  ",
        PGPORT: " 5432 ",
        PGUSER: "  postgres  ",
        POSTGRES_PASSWORD: "  local-secret  ",
        POSTGRES_DB: "  scholar_desk  ",
      }),
    );

    expect(url.hostname).toBe("localhost");
    expect(url.port).toBe("5432");
    expect(decodeURIComponent(url.username)).toBe("postgres");
    expect(url.password).toBe("local-secret");
    expect(url.pathname).toBe("/scholar_desk");
  });

  it("does not treat legacy MySQL variables as application database configuration", () => {
    expect(() =>
      resolveDatabaseUrl({
        MYSQL_URL: "mysql://root:secret@localhost:3306/scholar_desk",
        MYSQLHOST: "localhost",
        MYSQLUSER: "root",
        MYSQLDATABASE: "scholar_desk",
      }),
    ).toThrow("Set DATABASE_URL");
  });

  it("uses a valid migration URL and ignores a non-URL migration value", () => {
    expect(
      resolveMigrationDatabaseUrl({
        DATABASE_MIGRATION_URL: "postgres://migrator:secret@migration.example:5432/scholar_desk",
        DATABASE_URL: "postgres://app:secret@db.example:5432/scholar_desk",
      }),
    ).toBe("postgres://migrator:secret@migration.example:5432/scholar_desk");

    expect(
      resolveMigrationDatabaseUrl({
        DATABASE_MIGRATION_URL: "not-a-database-url",
        PGHOST: "db.supabase.co",
        PGUSER: "postgres",
        PGPASSWORD: "secret",
        PGDATABASE: "railway",
      }),
    ).toBe("postgres://postgres:secret@db.supabase.co:5432/railway");
  });
});
