#!/usr/bin/env node

import { diagnosePrivateStorage } from "../src/lib/file-storage.server.ts";

try {
  const result = await diagnosePrivateStorage();
  console.log("Private Storage diagnostic passed.", result);
} catch (error) {
  const details = error && typeof error === "object" ? error : {};
  console.error("Private Storage diagnostic failed.", {
    errorName:
      "name" in details && typeof details.name === "string" ? details.name : "UnknownError",
    code: "code" in details && typeof details.code === "string" ? details.code : null,
    httpStatus:
      "httpStatus" in details && typeof details.httpStatus === "number" ? details.httpStatus : null,
  });
  process.exitCode = 1;
}
