import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const serverEntry = resolve(process.cwd(), ".output/server/index.mjs");

try {
  await access(serverEntry);
} catch {
  console.error("Production server is missing. Run `npm run build` before `npm start`.");
  process.exit(1);
}

process.env.HOST ??= "0.0.0.0";
await import(pathToFileURL(serverEntry).href);
