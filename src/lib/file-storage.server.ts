import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type StorageArea = "requests" | "library";
type SupabaseStorageConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};
const MAX_CONFIGURED_FILE_BYTES = 100 * 1024 * 1024;

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

function missingRemoteFileError() {
  return Object.assign(new Error("File is unavailable."), { code: "ENOENT" });
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
  const config = getSupabaseStorageConfig();
  if (config) {
    const response = await fetch(getObjectUrl(config, getObjectPath(key, area)), {
      method: "POST",
      headers: {
        ...getStorageHeaders(config),
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: content,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed (${response.status}).`);
    }
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
  const config = getSupabaseStorageConfig();
  if (config) {
    const response = await fetch(getObjectUrl(config, getObjectPath(key, area)), {
      headers: getStorageHeaders(config),
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) throw missingRemoteFileError();
    if (!response.ok) {
      throw new Error(`Supabase Storage download failed (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  return readFile(getPrivateFilePath(key, area));
}

export async function deletePrivateFile(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");
  const config = getSupabaseStorageConfig();
  if (config) {
    const response = await fetch(
      `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,
      {
        method: "DELETE",
        headers: {
          ...getStorageHeaders(config),
          "content-type": "application/json",
        },
        body: JSON.stringify({ prefixes: [getObjectPath(key, area)] }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase Storage delete failed (${response.status}).`);
    }
    return;
  }
  await rm(getPrivateFilePath(key, area), { force: true });
}
