const safeCssIdentifier = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const safeChartColor =
  /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]{1,20}|var\(--[A-Za-z_][A-Za-z0-9_-]*\)|(?:hsl|hsla|rgb|rgba|oklch|oklab|color)\([\da-z.%\s,/()+-]+\))$/i;

export function isSafeChartConfigKey(value: string) {
  return safeCssIdentifier.test(value);
}

export function isSafeChartCssValue(value: string) {
  return safeChartColor.test(value.trim()) && !/\b(?:url|expression)\s*\(/i.test(value);
}

export function safeChartId(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "");
}
