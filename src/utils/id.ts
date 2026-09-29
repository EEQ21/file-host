import { randomBytes } from "node:crypto";

/** URL-safe, unguessable file identifier (128 bits). */
export function generateFileId(): string {
  return randomBytes(16).toString("base64url");
}

const ID_PATTERN = /^[A-Za-z0-9_-]{16,32}$/;

export function isValidFileId(id: string): boolean {
  return ID_PATTERN.test(id);
}
