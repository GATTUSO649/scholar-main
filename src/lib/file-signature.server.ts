const signatures: Record<string, readonly number[]> = {
  ".pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  ".doc": [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
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

export function hasSupportedLibraryFileSignature(extension: string, bytes: Uint8Array) {
  if (extension === ".epub" || extension === ".docx") return isZip(bytes);
  if (extension === ".txt") return isUtf8Text(bytes);
  const signature = signatures[extension];
  return signature ? startsWith(bytes, signature) : false;
}
