import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type StorageArea = "requests" | "library";
type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};
export type PrivateFileStorageOperation = "upload" | "download" | "delete" | "bucket_check";

export class PrivateFileStorageError extends Error {
  readonly operation: PrivateFileStorageOperation;
  readonly bucket: string;
  readonly objectPath: string;
  readonly httpStatus: number | undefined;
  readonly storageCode: string | undefined;
  readonly destinationHostname: string | undefined;
  readonly durationMs: number | undefined;
  readonly retryAttempt: number | undefined;
  readonly originalMessage: string;
  readonly sourceErrorName: string;

  constructor(input: {
    operation: PrivateFileStorageOperation;
    bucket: string;
    objectPath: string;
    originalMessage: string;
    sourceErrorName?: string;
    httpStatus?: number;
    storageCode?: string;
    errorCode?: string;
    destinationHostname?: string;
    durationMs?: number;
    retryAttempt?: number;
  }) {
    super(input.originalMessage);
    this.name = "PrivateFileStorageError";
    this.operation = input.operation;
    this.bucket = input.bucket;
    this.objectPath = input.objectPath;
    this.httpStatus = input.httpStatus;
    this.storageCode = input.storageCode;
    this.destinationHostname = input.destinationHostname;
    this.durationMs = input.durationMs;
    this.retryAttempt = input.retryAttempt;
    this.originalMessage = input.originalMessage;
    this.sourceErrorName = input.sourceErrorName ?? "Error";
    if (input.httpStatus === 404) this.code = "ENOENT";
    else if (input.errorCode) this.code = input.errorCode;
  }

  declare code?: string;
}

const MAX_CONFIGURED_FILE_BYTES = 100 * 1024 * 1024;
const STORAGE_REQUEST_TIMEOUT_MS = 30_000;
const MAX_STORAGE_ATTEMPTS = 3;
const RETRYABLE_STORAGE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function sanitizeStorageMessage(message: string, serviceRoleKey?: string) {
  let safeMessage = message.replace(/[\r\n\t]/g, " ").slice(0, 500);
  if (serviceRoleKey) safeMessage = safeMessage.split(serviceRoleKey).join("[REDACTED]");
  return safeMessage
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[REDACTED_TOKEN]")
    .replace(/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+\b/g, "[REDACTED_KEY]");
}

function storageFailure(
  operation: PrivateFileStorageOperation,
  bucket: string,
  objectPath: string,
  error: unknown,
  config?: SupabaseStorageConfig,
  diagnostics: { durationMs?: number; retryAttempt?: number } = {},
) {
  const details = getErrorDetails(error);
  const originalMessage = sanitizeStorageMessage(
    details.message ?? "Unknown Supabase Storage failure.",
    config?.serviceRoleKey,
  );
  return new PrivateFileStorageError({
    operation,
    bucket,
    objectPath,
    originalMessage,
    sourceErrorName: details.name ?? "UnknownError",
    ...(details.httpStatus ? { httpStatus: details.httpStatus } : {}),
    ...(details.storageCode ? { storageCode: details.storageCode } : {}),
    ...(details.code ? { errorCode: details.code } : {}),
    ...(config ? { destinationHostname: new URL(config.url).hostname } : {}),
    ...diagnostics,
  });
}

type StorageClient = ReturnType<typeof createClient>;

function getErrorDetails(error: unknown) {
  const pending = [error];
  const visited = new Set<unknown>();
  let name: string | undefined;
  let message: string | undefined;
  let code: string | undefined;
  let storageCode: string | undefined;
  let httpStatus: number | undefined;

  while (pending.length) {
    const current = pending.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const record = current as Record<string, unknown>;
    if (!name && typeof record.name === "string") name = record.name;
    if (!message && typeof record.message === "string") message = record.message;
    if (!code && typeof record.code === "string") code = record.code;
    if (!storageCode && typeof record.code === "string" && !/^\d+$/.test(record.code)) {
      storageCode = record.code;
    }
    if (!storageCode && typeof record.statusCode === "string" && !/^\d+$/.test(record.statusCode)) {
      storageCode = record.statusCode;
    }
    if (!httpStatus) {
      if (typeof record.httpStatus === "number") httpStatus = record.httpStatus;
      else if (typeof record.status === "number") httpStatus = record.status;
      else if (typeof record.statusCode === "string" && /^\d+$/.test(record.statusCode)) {
        httpStatus = Number(record.statusCode);
      }
    }
    if (record.cause) pending.push(record.cause);
    if (record.originalError) pending.push(record.originalError);
  }

  return { name, message, code, storageCode, httpStatus };
}

function getHostname(input: RequestInfo | URL) {
  try {
    const url = input instanceof Request ? input.url : String(input);
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function createDiagnosticFetch(
  operation: PrivateFileStorageOperation,
  retryAttempt: number,
  serviceRoleKey: string,
) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const startedAt = Date.now();
    const destinationHostname = getHostname(input);
    const timeoutSignal = AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS);
    const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const signal = requestSignal ? AbortSignal.any([requestSignal, timeoutSignal]) : timeoutSignal;
    try {
      const response = await fetch(input, { ...init, signal });
      const diagnostics = {
        destinationHostname,
        operation,
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
        retryAttempt,
      };
      if (response.ok) {
        console.info("Supabase Storage request completed.", diagnostics);
      } else {
        const payload = (await response
          .clone()
          .json()
          .catch(() => null)) as {
          code?: unknown;
          error?: unknown;
          message?: unknown;
        } | null;
        console.warn("Supabase Storage request returned an error.", {
          ...diagnostics,
          code:
            typeof payload?.code === "string"
              ? sanitizeStorageMessage(payload.code, serviceRoleKey)
              : null,
          message: sanitizeStorageMessage(
            (typeof payload?.message === "string" && payload.message) ||
              (typeof payload?.error === "string" && payload.error) ||
              response.statusText ||
              `HTTP ${response.status}`,
            serviceRoleKey,
          ),
        });
      }
      return response;
    } catch (error) {
      const details = getErrorDetails(error);
      console.warn("Supabase Storage request failed.", {
        destinationHostname,
        operation,
        httpStatus: null,
        code: details.code ?? null,
        message: sanitizeStorageMessage(
          details.message ?? "Storage request failed.",
          serviceRoleKey,
        ),
        durationMs: Date.now() - startedAt,
        retryAttempt,
      });
      throw error;
    }
  };
}

function createStorageClient(
  config: SupabaseStorageConfig,
  operation: PrivateFileStorageOperation,
  retryAttempt: number,
) {
  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: `private-storage-${operation}-${retryAttempt}-${crypto.randomUUID()}`,
    },
    global: {
      fetch: createDiagnosticFetch(operation, retryAttempt, config.serviceRoleKey),
    },
  });
}

function isRetryableStorageError(error: unknown) {
  const details = getErrorDetails(error);
  return (
    (details.code !== undefined && RETRYABLE_STORAGE_CODES.has(details.code)) ||
    [408, 429, 500, 502, 503, 504].includes(details.httpStatus ?? 0)
  );
}

async function runStorageOperation<T>(
  config: SupabaseStorageConfig,
  operation: PrivateFileStorageOperation,
  objectPath: string,
  execute: (client: StorageClient) => Promise<{ data: T; error: unknown }>,
) {
  const startedAt = Date.now();
  let lastError: unknown;
  let lastRetryAttempt = 1;

  for (let retryAttempt = 1; retryAttempt <= MAX_STORAGE_ATTEMPTS; retryAttempt += 1) {
    lastRetryAttempt = retryAttempt;
    try {
      const client = createStorageClient(config, operation, retryAttempt);
      const result = await execute(client);
      if (result.error) throw result.error;
      return result.data;
    } catch (error) {
      lastError = error;
      if (!isRetryableStorageError(error) || retryAttempt === MAX_STORAGE_ATTEMPTS) break;
      const details = getErrorDetails(error);
      console.warn("Retrying transient Supabase Storage failure.", {
        destinationHostname: new URL(config.url).hostname,
        operation,
        httpStatus: details.httpStatus ?? null,
        code: details.code ?? null,
        message: sanitizeStorageMessage(
          details.message ?? "Storage request failed.",
          config.serviceRoleKey,
        ),
        durationMs: Date.now() - startedAt,
        retryAttempt,
      });
      await new Promise((resolve) => setTimeout(resolve, 150 * retryAttempt));
    }
  }

  throw storageFailure(operation, config.bucket, objectPath, lastError, config, {
    durationMs: Date.now() - startedAt,
    retryAttempt: lastRetryAttempt,
  });
}

function getStorageConfigForFile(
  operation: PrivateFileStorageOperation,
  key: string,
  area: StorageArea,
) {
  const bucket = process.env["SUPABASE_STORAGE_BUCKET"]?.trim() || "private-uploads";
  const objectPath = getObjectPath(key, area);
  try {
    const config = getSupabaseStorageConfig();
    if (config) return config;
    if (process.env["NODE_ENV"] === "production") {
      throw new Error("Supabase Storage must be configured for production file storage.");
    }
    return null;
  } catch (error) {
    throw storageFailure(operation, bucket, objectPath, error);
  }
}

export function getConfiguredFileLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  if (!Number.isSafeInteger(configured) || configured <= 0) return fallback;
  return Math.min(configured, MAX_CONFIGURED_FILE_BYTES);
}

function getSupabaseStorageConfig(): SupabaseStorageConfig | null {
  const url = process.env["SUPABASE_URL"]?.trim() ?? "";
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() ?? "";
  if (!url && !serviceRoleKey) return null;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage configuration is incomplete. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL must be an absolute HTTPS URL.");
  }
  if (
    parsedUrl.protocol !== "https:" &&
    !(parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedUrl.hostname))
  ) {
    throw new Error("SUPABASE_URL must use HTTPS.");
  }
  if (
    parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error("SUPABASE_URL must be the project origin without a path or credentials.");
  }

  const bucket = process.env["SUPABASE_STORAGE_BUCKET"]?.trim() || "private-uploads";
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(bucket)) {
    throw new Error("SUPABASE_STORAGE_BUCKET has an invalid name.");
  }

  return { url: parsedUrl.origin, serviceRoleKey, bucket };
}

function getLocalUploadRoot() {
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Supabase Storage must be configured for production file storage.");
  }
  const configuredRoot = process.env["FILE_STORAGE_DIR"]?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }
  return path.resolve(process.cwd(), "data", "uploads");
}

function getObjectPath(key: string, area: StorageArea) {
  return `${area}/${key.slice(0, 2)}/${key}`;
}

export async function verifyPrivateStorageBucket() {
  const config = getSupabaseStorageConfig();
  if (!config) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "Supabase Storage must be configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
    return;
  }

  const bucket = await runStorageOperation(config, "bucket_check", "", (client) =>
    client.storage.getBucket(config.bucket),
  );
  if (bucket.public !== false) {
    throw new Error(`Supabase Storage bucket "${config.bucket}" must be private.`);
  }
}

export async function diagnosePrivateStorage() {
  const config = getSupabaseStorageConfig();
  if (!config) {
    throw new Error(
      "Supabase Storage must be configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  await verifyPrivateStorageBucket();
  const objectPath = `diagnostics/${crypto.randomUUID()}.txt`;
  const probe = Buffer.from(`storage-diagnostic:${crypto.randomUUID()}`);
  let uploadAttempted = false;
  let operationError: unknown;
  let cleanupError: unknown;
  try {
    uploadAttempted = true;
    await runStorageOperation(config, "upload", objectPath, (client) =>
      client.storage.from(config.bucket).upload(objectPath, probe, {
        contentType: "text/plain",
        upsert: false,
      }),
    );
    const downloaded = await runStorageOperation(config, "download", objectPath, (client) =>
      client.storage.from(config.bucket).download(objectPath),
    );
    if (!Buffer.from(await downloaded.arrayBuffer()).equals(probe)) {
      throw new Error("Supabase Storage diagnostic returned unexpected object contents.");
    }
  } catch (error) {
    operationError = error;
  }
  if (uploadAttempted) {
    try {
      await runStorageOperation(config, "delete", objectPath, (client) =>
        client.storage.from(config.bucket).remove([objectPath]),
      );
    } catch (error) {
      cleanupError = error;
    }
  }
  if (operationError) {
    if (cleanupError) {
      const details = getErrorDetails(cleanupError);
      console.error("Private storage diagnostic cleanup failed.", {
        destinationHostname: new URL(config.url).hostname,
        operation: "delete",
        httpStatus: details.httpStatus ?? null,
        code: details.code ?? null,
        message: sanitizeStorageMessage(
          details.message ?? "Storage diagnostic cleanup failed.",
          config.serviceRoleKey,
        ),
      });
    }
    throw operationError;
  }
  if (cleanupError) throw cleanupError;

  return {
    connected: true,
    bucketExists: true,
    bucketPrivate: true,
    upload: true,
    download: true,
    cleanup: true,
    destinationHostname: new URL(config.url).hostname,
  };
}

async function privateObjectExists(config: SupabaseStorageConfig, objectPath: string) {
  const lastSlash = objectPath.lastIndexOf("/");
  const folder = objectPath.slice(0, lastSlash);
  const fileName = objectPath.slice(lastSlash + 1);
  const files = await runStorageOperation(config, "bucket_check", objectPath, (client) =>
    client.storage.from(config.bucket).list(folder, { limit: 100, search: fileName }),
  );
  return files.some((file) => file.name === fileName);
}

async function migrateFilesToSupabase(sourceRoot: string, config: SupabaseStorageConfig) {
  const files = await findPrivateFiles(sourceRoot);
  let copied = 0;
  let skipped = 0;

  for (const filePath of files) {
    const relativeParts = path.relative(sourceRoot, filePath).split(path.sep);
    const area: StorageArea = relativeParts[0] === "library" ? "library" : "requests";
    const key = path.basename(filePath);
    const targetPath = getObjectPath(key, area);
    if (await privateObjectExists(config, targetPath)) {
      skipped += 1;
      continue;
    }

    await writePrivateFile(key, await readFile(filePath), area, "application/octet-stream");
    copied += 1;
  }

  return {
    sourceRoot,
    destinationRoot: `Supabase Storage: ${config.bucket}`,
    scanned: files.length,
    copied,
    skipped,
  };
}

export function getPrivateFilePath(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");

  return path.join(
    getLocalUploadRoot(),
    ...(area === "library" ? ["library"] : []),
    key.slice(0, 2),
    key,
  );
}

export async function writePrivateFile(
  key: string,
  content: Uint8Array,
  area: StorageArea = "requests",
  contentType = "application/octet-stream",
  upsert = false,
) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getStorageConfigForFile("upload", key, area);
  if (config) {
    const objectPath = getObjectPath(key, area);
    await runStorageOperation(config, "upload", objectPath, (client) =>
      client.storage.from(config.bucket).upload(objectPath, content, {
        contentType,
        upsert,
      }),
    );
    return;
  }
  const destination = getPrivateFilePath(key, area);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, content, { flag: "wx", mode: 0o600 });
}

async function pathExists(target: string) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function findPrivateFiles(root: string) {
  const files: string[] = [];

  async function walk(currentPath: string) {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  if (!(await pathExists(root))) return files;
  await walk(root);
  return files;
}

export async function migrateLegacyPrivateFiles(
  sourceRoot = process.env["LEGACY_FILE_STORAGE_DIR"]?.trim() ||
    process.env["FILE_STORAGE_DIR"]?.trim() ||
    path.join(process.cwd(), "data", "uploads"),
  destinationRoot?: string,
) {
  const resolvedSource = path.resolve(sourceRoot);
  const config = getSupabaseStorageConfig();
  if (config && destinationRoot === undefined) {
    return migrateFilesToSupabase(resolvedSource, config);
  }
  const resolvedDestination = path.resolve(destinationRoot ?? getLocalUploadRoot());

  if (resolvedSource === resolvedDestination) {
    return {
      sourceRoot: resolvedSource,
      destinationRoot: resolvedDestination,
      scanned: 0,
      copied: 0,
      skipped: 0,
    };
  }

  const files = await findPrivateFiles(resolvedSource);
  let copied = 0;
  let skipped = 0;

  for (const filePath of files) {
    const relativePath = path.relative(resolvedSource, filePath);
    const targetPath = path.join(resolvedDestination, relativePath);

    if (await pathExists(targetPath)) {
      skipped += 1;
      continue;
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(filePath, targetPath);
    copied += 1;
  }

  return {
    sourceRoot: resolvedSource,
    destinationRoot: resolvedDestination,
    scanned: files.length,
    copied,
    skipped,
  };
}

export async function readPrivateFile(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getStorageConfigForFile("download", key, area);
  if (config) {
    const objectPath = getObjectPath(key, area);
    const file = await runStorageOperation(config, "download", objectPath, (client) =>
      client.storage.from(config.bucket).download(objectPath),
    );
    return Buffer.from(await file.arrayBuffer());
  }
  return readFile(getPrivateFilePath(key, area));
}

export async function deletePrivateFile(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getStorageConfigForFile("delete", key, area);
  if (config) {
    const objectPath = getObjectPath(key, area);
    await runStorageOperation(config, "delete", objectPath, (client) =>
      client.storage.from(config.bucket).remove([objectPath]),
    );
    return;
  }
  await rm(getPrivateFilePath(key, area), { force: true });
}
