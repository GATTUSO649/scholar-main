import path from "node:path";

const documentMimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
};

const oleSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const mimeAliases: Record<string, readonly string[]> = {
  ".docx": ["application/zip"],
  ".xlsx": ["application/zip"],
  ".pptx": ["application/zip"],
};

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[index] === byte);
}

function isZip(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function isUtf8Text(bytes: Uint8Array) {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function zipEntries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const minEnd = Math.max(0, bytes.length - 65_557);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= minEnd; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) return null;

  const entryCount = view.getUint16(endOffset + 10, true);
  const directorySize = view.getUint32(endOffset + 12, true);
  let offset = view.getUint32(endOffset + 16, true);
  if (entryCount > 4096 || offset + directorySize > bytes.length) return null;

  const names = new Set<string>();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) return null;
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const nameStart = offset + 46;
      const nameEnd = nameStart + nameLength;
      if (nameEnd > bytes.length) return null;
      names.add(decoder.decode(bytes.subarray(nameStart, nameEnd)));
      offset = nameEnd + extraLength + commentLength;
    }
  } catch {
    return null;
  }
  return names;
}

function hasExpectedSignature(extension: string, bytes: Uint8Array) {
  if (extension === ".pdf") return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  if ([".doc", ".xls", ".ppt"].includes(extension)) return startsWith(bytes, oleSignature);
  if (extension === ".txt") return isUtf8Text(bytes);
  if (!isZip(bytes)) return false;

  const entries = zipEntries(bytes);
  if (!entries?.has("[Content_Types].xml")) return false;
  if (extension === ".docx") return entries.has("word/document.xml");
  if (extension === ".xlsx") return entries.has("xl/workbook.xml");
  if (extension === ".pptx") return entries.has("ppt/presentation.xml");
  return false;
}

export function getDocumentMimeType(extension: string) {
  return documentMimeTypes[extension.toLowerCase()] ?? null;
}

export function validateDocumentFile(name: string, mimeType: string, bytes: Uint8Array) {
  const extension = path.extname(name).toLowerCase();
  const expectedMimeType = getDocumentMimeType(extension);
  if (!expectedMimeType) return { error: "Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, and TXT." };

  const suppliedMimeType = mimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const allowedMimeTypes = [expectedMimeType, "application/octet-stream", ...(mimeAliases[extension] ?? [])];
  if (suppliedMimeType && !allowedMimeTypes.includes(suppliedMimeType)) {
    return { error: "The file type does not match its extension." };
  }
  if (!hasExpectedSignature(extension, bytes)) {
    return { error: "The file contents do not match the selected document type." };
  }
  return { mimeType: expectedMimeType };
}
