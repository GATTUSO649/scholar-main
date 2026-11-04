import { describe, expect, it } from "vitest";
import { isSafeChartConfigKey, isSafeChartCssValue, safeChartId } from "@/lib/chart-style";

describe("chart style input validation", () => {
  it("accepts common safe chart color forms", () => {
    expect(isSafeChartCssValue("#0f8")).toBe(true);
    expect(isSafeChartCssValue("hsl(var(--chart-1))")).toBe(true);
    expect(isSafeChartCssValue("oklch(0.7 0.1 150)")).toBe(true);
  });

  it("rejects style-breaking colors and variable names", () => {
    expect(isSafeChartCssValue("red; } body { display:none")).toBe(false);
    expect(isSafeChartCssValue("url(https://attacker.example/pixel)")).toBe(false);
    expect(isSafeChartConfigKey("sales; } body { color: red")).toBe(false);
    expect(isSafeChartConfigKey("sales-total")).toBe(true);
  });

  it("removes CSS selector metacharacters from chart IDs", () => {
    expect(safeChartId("chart] body { color:red }")).toBe("chartbodycolorred");
  });
});
