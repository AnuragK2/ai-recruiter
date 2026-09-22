import { getConfig } from "../config";
import { AppError } from "../errors";

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError("validation", "Content-Type must be application/json.");
  }

  const maxBytes = getConfig().MAX_BODY_BYTES;
  const declared = request.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > maxBytes) {
      throw new AppError(
        "payload_too_large",
        `Request body must be under ${maxBytes} bytes.`,
      );
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new AppError("validation", "Could not read the request body.");
  }

  if (text.length > maxBytes) {
    throw new AppError(
      "payload_too_large",
      `Request body must be under ${maxBytes} bytes.`,
    );
  }

  if (!text.trim()) {
    throw new AppError("validation", "Body must be valid JSON.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AppError("validation", "Body must be valid JSON.");
  }
}
