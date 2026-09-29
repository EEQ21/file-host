import path from "node:path";

const MAX_FILENAME_LENGTH = 255;

/** Sanitize original filename for Content-Disposition (never used as storage key). */
export function sanitizeFilename(raw: string): string {
  let name = raw.replace(/\0/g, "").trim();
  name = path.basename(name);
  name = name.replace(/[\r\n"\\]/g, "_");
  if (!name || name === "." || name === "..") {
    name = "download";
  }
  if (name.length > MAX_FILENAME_LENGTH) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);
    name = base.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
  }
  return name;
}

export function getExtension(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return ext || "";
}
