const FORCE_DOWNLOAD_EXT = new Set([
  "exe",
  "apk",
  "dmg",
  "msi",
  "bat",
  "cmd",
  "com",
  "scr",
  "html",
  "htm",
  "xhtml",
  "svg",
  "js",
  "mjs",
  "cjs",
  "php",
  "jar",
  "vbs",
  "ps1",
  "sh",
  "iso",
]);

export function shouldForceDownload(filename: string, _mime?: string | null): boolean {
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  return FORCE_DOWNLOAD_EXT.has(ext);
}

export function resolveContentType(storedMime: string | null, filename: string): string {
  if (storedMime && storedMime !== "application/octet-stream") {
    return storedMime;
  }
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : "";
  const map: Record<string, string> = {
    zip: "application/zip",
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    json: "application/json",
    txt: "text/plain",
    csv: "text/csv",
  };
  if (ext && map[ext]) return map[ext];
  return "application/octet-stream";
}

const PREVIEW_IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const PREVIEW_VIDEO_EXT = new Set(["mp4"]);

export type PreviewKind = "image" | "video";

export function getPreviewKind(filename: string): PreviewKind | null {
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  if (PREVIEW_IMAGE_EXT.has(ext)) return "image";
  if (PREVIEW_VIDEO_EXT.has(ext)) return "video";
  return null;
}

export function isPreviewContentType(contentType: string, kind: PreviewKind): boolean {
  if (kind === "image") return contentType.startsWith("image/");
  if (kind === "video") return contentType === "video/mp4";
  return false;
}
