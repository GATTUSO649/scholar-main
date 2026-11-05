import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

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
  }) {
    super(input.originalMessage);
    this.name = "PrivateFileStorageError";
    this.operation = input.operation;
    this.bucket = input.bucket;
    this.objectPath = input.objectPath;
    this.httpStatus = input.httpStatus;
    this.storageCode = input.storageCode;
    this.originalMessage = input.originalMessage;
    this.sourceErrorName = input.sourceErrorName ?? "Error";
    if (input.httpStatus === 404) this.code = "ENOENT";
    else if (input.storageCode) this.code = input.storageCode;
  }

  declare code?: string;
}

const MAX_CONFIGURED_FILE_BYTES = 100 * 1024 * 1024;

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
) {
  const sourceErrorName = error instanceof Error ? error.name : "UnknownError";
  const originalMessage = sanitizeStorageMessage(
    error instanceof Error ? error.message : "Unknown Supabase Storage failure.",
    config?.serviceRoleKey,
  );
  return new PrivateFileStorageError({
    operation,
    bucket,
    objectPath,
    originalMessage,
    sourceErrorName,
    ...(error &&
    typeof error === "object" &&
    "httpStatus" in error &&
    typeof error.httpStatus === "number"
      ? { httpStatus: error.httpStatus }
      : {}),
    ...(error &&
    typeof error === "object" &&
    "storageCode" in error &&
    typeof error.storageCode === "string"
      ? { storageCode: error.storageCode }
      : {}),
  });
}

async function fetchStorageObject(
  config: SupabaseStorageConfig,
  operation: PrivateFileStorageOperation,
  objectPath: string,
  init: RequestInit,
  url = getObjectUrl(config, objectPath),
) {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw storageFailure(operation, config.bucket, objectPath, error, config);
  }
  if (response.ok || (operation === "delete" && response.status === 404)) return response;

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    statusCode?: unknown;
  } | null;
  const upstreamMessage =
    (typeof payload?.message === "string" && payload.message) ||
    (typeof payload?.error === "string" && payload.error) ||
    response.statusText ||
    `HTTP ${response.status}`;
  const upstreamCode =
    (typeof payload?.code === "string" && payload.code) ||
    (typeof payload?.statusCode === "string" && payload.statusCode) ||
    undefined;
  throw storageFailure(
    operation,
    config.bucket,
    objectPath,
    Object.assign(new Error(upstreamMessage), {
      name: "SupabaseStorageResponseError",
      httpStatus: response.status,
      ...(upstreamCode ? { storageCode: upstreamCode } : {}),
    }),
    config,
  );
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

  const bucket = process.env["SUPABASE_STORAGE_BUCKET"]?.trim() || "private-uploads";
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(bucket)) {
    throw new Error("SUPABASE_STORAGE_BUCKET has an invalid name.");
  }

  return { url: url.replace(/\/$/, ""), serviceRoleKey, bucket };
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

function getObjectUrl(config: SupabaseStorageConfig, objectPath: string) {
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  return `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}/${encodedPath}`;
}

function getStorageHeaders(config: SupabaseStorageConfig) {
  return {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
  };
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

  const response = await fetch(
    `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,
    {
      headers: getStorageHeaders(config),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? `Supabase Storage bucket "${config.bucket}" does not exist.`
        : `Supabase Storage bucket check failed (${response.status}).`,
    );
  }
  const bucket = (await response.json().catch(() => null)) as { public?: unknown } | null;
  if (bucket?.public !== false) {
    throw new Error(`Supabase Storage bucket "${config.bucket}" must be private.`);
  }
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
    const existing = await fetch(getObjectUrl(config, targetPath), {
      headers: getStorageHeaders(config),
      signal: AbortSignal.timeout(30_000),
    });
    if (existing.ok) {
      await existing.body?.cancel();
      skipped += 1;
      continue;
    }
    await existing.body?.cancel();
    if (existing.status !== 404) {
      throw new Error(`Supabase Storage migration check failed (${existing.status}).`);
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
) {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getStorageConfigForFile("upload", key, area);
  if (config) {
    const response = await fetchStorageObject(config, "upload", getObjectPath(key, area), {
      method: "POST",
      headers: {
        ...getStorageHeaders(config),
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: content,
      signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
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
    const response = await fetchStorageObject(config, "download", getObjectPath(key, area), {
      headers: getStorageHeaders(config),
      signal: AbortSignal.timeout(30_000),
    });
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(getPrivateFilePath(key, area));
}

export async function deletePrivateFile(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getStorageConfigForFile("delete", key, area);
  if (config) {
    const objectPath = getObjectPath(key, area);
    await fetchStorageObject(
      config,
      "delete",
      objectPath,
      {
        method: "DELETE",
        headers: {
          ...getStorageHeaders(config),
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefixes: [objectPath] }),
        signal: AbortSignal.timeout(30_000),
      },
      `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
    );
    return;
  }
  await rm(getPrivateFilePath(key, area), { force: true });
}
