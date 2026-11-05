import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type StorageArea = "requests" | "library";
const MAX_CONFIGURED_FILE_BYTES = 100 * 1024 * 1024;

export function getConfiguredFileLimit(name: string, fallback: number) {
  const configured = Number(process.env[name]);
  if (!Number.isSafeInteger(configured) || configured <= 0) return fallback;
  return Math.min(configured, MAX_CONFIGURED_FILE_BYTES);
}

function getFixedUploadRoot() {
  return process.env["NODE_ENV"] === "production"
    ? path.resolve("/var/data/uploads")
    : path.resolve(process.cwd(), "data", "uploads");
}

export function getPrivateFilePath(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");

  return path.join(
    getFixedUploadRoot(),
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
  void contentType;
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
  sourceRoot = path.join(process.cwd(), "data", "uploads"),
  destinationRoot?: string,
) {
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedDestination = path.resolve(destinationRoot ?? getFixedUploadRoot());

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
  return readFile(getPrivateFilePath(key, area));
}

export async function deletePrivateFile(key: string, area: StorageArea = "requests") {
  await rm(getPrivateFilePath(key, area), { force: true });
}
