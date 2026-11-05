#!/usr/bin/env node

import path from "node:path";
import {
  migrateLegacyPrivateFiles,
  verifyPrivateStorageBucket,
} from "../src/lib/file-storage.server.ts";

if (!process.env["SUPABASE_URL"]?.trim() || !process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim()) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before migrating uploads.");
}
await verifyPrivateStorageBucket();

const legacyRoot =
  process.env["LEGACY_FILE_STORAGE_DIR"]?.trim() ||
  process.env["FILE_STORAGE_DIR"]?.trim() ||
  path.resolve(process.cwd(), "data", "uploads");
const result = await migrateLegacyPrivateFiles(legacyRoot);

console.log(
  `Legacy upload scan complete: ${result.scanned} file(s) found in ${result.sourceRoot}.`,
);
if (result.copied > 0) {
  console.log(`Migrated ${result.copied} file(s) to ${result.destinationRoot}.`);
}
if (result.skipped > 0) {
  console.log(
    `${result.skipped} file(s) already existed in ${result.destinationRoot} and were left in place.`,
  );
}
if (result.scanned === 0) {
  console.log("No legacy upload files were found to move.");
}
