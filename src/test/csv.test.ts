import { describe, expect, it } from "vitest";
import { serializeCsv } from "@/lib/csv";

describe("CSV serialization", () => {
  it("quotes cells and escapes embedded quotes, commas, and line breaks", () => {
    expect(serializeCsv(["Name", "Notes"], [["Amina, N.", 'Said "hello"\nagain']])).toBe(
      '"Name","Notes"\r\n"Amina, N.","Said ""hello""\nagain"',
    );
  });

  it("protects spreadsheet formula cells", () => {
    expect(serializeCsv(["Value"], [["=1+1"], ["  @SUM(A1:A2)"], ["-10"]])).toBe(
      '"Value"\r\n"\'=1+1"\r\n"\'  @SUM(A1:A2)"\r\n"\'-10"',
    );
  });

  it("serializes nullish values as empty cells", () => {
    expect(serializeCsv(["Name", "Email"], [["Student", null]])).toBe(
      '"Name","Email"\r\n"Student",""',
    );
  });
});
