import path from "node:path";

type StorageArea = "requests" | "library";

export function getPrivateFilePath(key: string, area: StorageArea = "requests") {
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new Error("Invalid file key.");

  const configuredRoot = process.env["FILE_STORAGE_DIR"]?.trim();
  if (
    process.env["NODE_ENV"] === "production" &&
    (!configuredRoot || !path.isAbsolute(configuredRoot))
  ) {
    throw new Error("FILE_STORAGE_DIR must be an absolute path to persistent private storage.");
  }

  const root = path.resolve(configuredRoot || path.join(process.cwd(), "data", "uploads"));
  return path.join(root, ...(area === "library" ? ["library"] : []), key.slice(0, 2), key);
}
