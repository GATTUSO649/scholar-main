export class UploadBodyTooLargeError extends Error {
  constructor() {
    super("Upload request is too large.");
  }
}

export class InvalidUploadBodyError extends Error {
  constructor() {
    super("Invalid multipart upload request.");
  }
}

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
  }
}

export class InvalidRequestBodyError extends Error {
  constructor() {
    super("Invalid request body.");
  }
}

async function readBoundedRequestBytes(request: Request, maxBytes: number) {
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader !== null) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new InvalidRequestBodyError();
    }
    if (contentLength > maxBytes) throw new RequestBodyTooLargeError();
  }

  const reader = request.body?.getReader();
  if (!reader) throw new InvalidRequestBodyError();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function parseJsonRequestBody(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/(?:[\w.+-]*\+)?json(?:;|$)/i.test(contentType)) {
    throw new InvalidRequestBodyError();
  }

  const body = await readBoundedRequestBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch {
    throw new InvalidRequestBodyError();
  }
}

export async function parseMultipartFormData(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    throw new InvalidUploadBodyError();
  }

  let body: Blob;
  try {
    body = new Blob([await readBoundedRequestBytes(request, maxBytes)]);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) throw new UploadBodyTooLargeError();
    throw new InvalidUploadBodyError();
  }

  try {
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
    return await boundedRequest.formData();
  } catch {
    throw new InvalidUploadBodyError();
  }
}
