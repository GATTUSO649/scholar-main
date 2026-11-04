#!/usr/bin/env node

import path from "node:path";
import { migrateLegacyPrivateFiles } from "../src/lib/file-storage.server.ts";

const configuredRoot = process.env["FILE_STORAGE_DIR"]?.trim();
if (!configuredRoot || !path.isAbsolute(configuredRoot)) {
  throw new Error(
    "Set FILE_STORAGE_DIR to an absolute path for the persistent private upload storage before running this migration.",
  );
}

const legacyRoot = path.resolve(process.cwd(), "data", "uploads");
const result = await migrateLegacyPrivateFiles(legacyRoot, configuredRoot);

console.log(`Legacy upload scan complete: ${result.scanned} file(s) found in ${result.sourceRoot}.`);
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
