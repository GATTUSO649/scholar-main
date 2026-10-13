import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "@/lib/database.server";

describe("Database environment configuration", () => {
  it("prefers MYSQL_URL when it is set", () => {
    expect(
      resolveDatabaseUrl({
        MYSQL_URL: "mysql://app:secret@db.example:3306/scholar_desk",
        MYSQLHOST: "ignored.example",
        MYSQLUSER: "ignored",
        MYSQLDATABASE: "ignored",
      }),
    ).toBe("mysql://app:secret@db.example:3306/scholar_desk");
  });

  it("builds a URL from Railway's MYSQL variables", () => {
    const url = new URL(
      resolveDatabaseUrl({
        MYSQLHOST: "mysql.railway.internal",
        MYSQLPORT: "3307",
        MYSQLUSER: "app@user",
        MYSQLPASSWORD: "p@ss:word",
        MYSQLDATABASE: "scholar_desk",
      }),
    );

    expect(url.hostname).toBe("mysql.railway.internal");
    expect(url.port).toBe("3307");
    expect(decodeURIComponent(url.username)).toBe("app@user");
    expect(decodeURIComponent(url.password)).toBe("p@ss:word");
    expect(url.pathname).toBe("/scholar_desk");
  });

  it("supports MYSQL_DATABASE and the root password alias", () => {
    const url = new URL(
      resolveDatabaseUrl({
        MYSQLHOST: "localhost",
        MYSQLUSER: "root",
        MYSQL_ROOT_PASSWORD: "local-secret",
        MYSQL_DATABASE: "scholar_desk",
      }),
    );

    expect(url.port).toBe("3306");
    expect(url.password).toBe("local-secret");
    expect(url.pathname).toBe("/scholar_desk");
  });
});
