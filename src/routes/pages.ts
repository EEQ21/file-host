import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { getFileById, isFileExpired } from "../db.js";
import { isValidFileId } from "../utils/id.js";
import { getExtension } from "../utils/filename.js";
import { getPreviewKind } from "../utils/mime.js";
import { layout } from "../views/layout.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../../public");

const RESERVED = new Set([
  "api",
  "d",
  "v",
  "css",
  "js",
  "terms",
  "privacy",
  "about",
  "favicon.ico",
]);

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatExpiration(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fileIconKind(filename: string): string {
  const ext = getExtension(filename);
  const map: Record<string, string> = {
    zip: "archive",
    rar: "archive",
    "7z": "archive",
    tar: "archive",
    gz: "archive",
    pdf: "pdf",
    doc: "doc",
    docx: "doc",
    xls: "sheet",
    xlsx: "sheet",
    ppt: "slides",
    pptx: "slides",
    txt: "text",
    csv: "text",
    jpg: "image",
    jpeg: "image",
    png: "image",
    gif: "image",
    webp: "image",
    mp4: "video",
    mov: "video",
    mkv: "video",
    mp3: "audio",
    wav: "audio",
    flac: "audio",
    json: "code",
    xml: "code",
    html: "code",
    css: "code",
    js: "code",
  };
  return map[ext] ?? "file";
}

export async function registerPageRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", (_req, reply) => {
    const content = fs.readFileSync(path.join(publicDir, "home-content.html"), "utf8");
    const html = layout({
      title: "Fike | Simple file hosting",
      active: "upload",
      content,
      mainClass: "hero",
      pageClass: " home-page",
      scripts:
        '<script src="/js/copy.js" defer></script>\n  <script src="/js/app.js" type="module"></script>',
    });
    return reply.type("text/html").send(html);
  });

  app.get("/about", (_req, reply) => {
    return reply.type("text/html").send(
      layout({
        title: "About us | Fike",
        active: "about",
        mainClass: "legal",
        content: aboutBody(),
      }),
    );
  });

  app.get("/terms", (_req, reply) => {
    return reply.type("text/html").send(
      layout({
        title: "Terms | Fike",
        active: "terms",
        mainClass: "legal",
        content: `<h1>Terms</h1>${termsBody()}`,
      }),
    );
  });

  app.get("/privacy", (_req, reply) => {
    return reply.type("text/html").send(
      layout({
        title: "Privacy | Fike",
        active: "privacy",
        mainClass: "legal",
        content: `<h1>Privacy</h1>${privacyBody()}`,
      }),
    );
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (RESERVED.has(id.toLowerCase()) || !isValidFileId(id)) {
      return reply.callNotFound();
    }

    const record = getFileById(id);
    if (!record) {
      return reply.status(404).type("text/html").send(notFoundPage());
    }
    if (isFileExpired(record)) {
      return reply.status(410).type("text/html").send(expiredPage());
    }

    const shareUrl = `${config.appUrl}/${id}`;
    const downloadUrl = `${config.appUrl}/d/${id}`;
    const sizeLabel = formatBytes(record.size);
    const expiresLabel = formatExpiration(record.expires_at);
    const icon = fileIconKind(record.filename);
    const previewKind = getPreviewKind(record.filename);
    const previewUrl = previewKind ? `/v/${id}` : null;

    return reply.type("text/html").send(
      filePageHtml({
        filename: record.filename,
        sizeLabel,
        shareUrl,
        downloadUrl,
        expiresLabel,
        icon,
        previewKind,
        previewUrl,
      }),
    );
  });
}

function notFoundPage(): string {
  return layout({
    title: "File not found | Fike",
    active: "upload",
    mainClass: "error-main",
    pageClass: " file-page",
    content: `<div class="error-card">
      <h1>File not found</h1>
      <p class="muted">The file may have been deleted, expired, or the link may be incorrect.</p>
      <a href="/" class="btn btn-primary">Upload a file</a>
    </div>`,
  });
}

function expiredPage(): string {
  return layout({
    title: "File expired | Fike",
    active: "upload",
    mainClass: "error-main",
    pageClass: " file-page",
    content: `<div class="error-card">
      <h1>File expired</h1>
      <p class="muted">This file is no longer available.</p>
      <a href="/" class="btn btn-primary">Upload a file</a>
    </div>`,
  });
}

function previewBlock(
  kind: "image" | "video",
  url: string,
  filename: string,
): string {
  const safeUrl = escapeHtml(url);
  const safeName = escapeHtml(filename);
  if (kind === "image") {
    return `<figure class="file-preview-wrap">
      <img class="file-preview" src="${safeUrl}" alt="${safeName}" loading="lazy" decoding="async">
    </figure>`;
  }
  return `<figure class="file-preview-wrap">
    <video class="file-preview" src="${safeUrl}" controls playsinline preload="metadata" aria-label="Preview of ${safeName}"></video>
  </figure>`;
}

function filePageHtml(opts: {
  filename: string;
  sizeLabel: string;
  shareUrl: string;
  downloadUrl: string;
  expiresLabel: string | null;
  icon: string;
  previewKind: "image" | "video" | null;
  previewUrl: string | null;
}): string {
  const exp = opts.expiresLabel
    ? `<p class="expires muted">Available until ${escapeHtml(opts.expiresLabel)}</p>`
    : "";
  const preview =
    opts.previewKind && opts.previewUrl
      ? previewBlock(opts.previewKind, opts.previewUrl, opts.filename)
      : `<div class="file-icon file-icon--${opts.icon}" aria-hidden="true"></div>`;
  const content = `<div class="file-card">
      ${preview}
      <p class="eyebrow">File ready</p>
      <h1 class="file-name">${escapeHtml(opts.filename)}</h1>
      <p class="file-size muted">${escapeHtml(opts.sizeLabel)}</p>
      ${exp}
      <a href="${escapeHtml(opts.downloadUrl)}" class="btn btn-primary btn-lg">Download file</a>
      <div class="url-block">
        <label class="url-label">Direct download link</label>
        <div class="url-row">
          <code class="url-value" id="direct-url">${escapeHtml(opts.downloadUrl)}</code>
          <button type="button" class="btn btn-secondary copy-btn" data-copy="${escapeHtml(opts.downloadUrl)}">Copy</button>
        </div>
      </div>
    </div>`;
  return layout({
    title: `${opts.filename} | Fike`,
    active: "file",
    mainClass: "file-main",
    pageClass: " file-page",
    content,
    scripts: '<script src="/js/copy.js" defer></script>',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function aboutBody(): string {
  return `<h1>About Fike</h1>
    <p class="lead muted">Fike is anonymous file hosting built for speed and clarity. Upload once, share a link, and move on.</p>
    <section class="info-section">
      <h2>What we do</h2>
      <p class="muted">We give you a simple way to send large files without signing up, without dashboards, and without extra steps. Every upload gets a shareable page and a direct download URL.</p>
    </section>
    <section class="info-section">
      <h2>Why no accounts?</h2>
      <p class="muted">Most transfers do not need a profile. Skipping login keeps the experience fast and reduces the data we hold about you. You choose the file; we host it and return links.</p>
    </section>
    <section class="info-section">
      <h2>Security &amp; storage</h2>
      <p class="muted">Files receive random, unguessable IDs. Uploads are stored as data, not executed on the server. Downloads use safe headers, and previews are limited to trusted types like images and MP4.</p>
    </section>
    <section class="info-section">
      <h2>Limits</h2>
      <ul class="info-list muted">
        <li>Maximum <strong>1 GB</strong> per file</li>
        <li>All common file types supported</li>
        <li>Rate limits help prevent abuse</li>
        <li>Files may expire if configured by the operator</li>
      </ul>
    </section>
    <p><a href="/#upload" class="btn btn-primary">Start uploading</a></p>`;
}

function termsBody(): string {
  return `<p class="muted">Files are hosted anonymously. Do not upload illegal content. Files may expire per site configuration. Service is provided as-is without warranty.</p>`;
}

function privacyBody(): string {
  return `<p class="muted">We do not require accounts. Uploaded files and metadata (filename, size, upload time) are stored to provide share links. IP-based rate limits may apply for abuse prevention. We do not sell personal data.</p>`;
}
