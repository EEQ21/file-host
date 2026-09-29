import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getFileById, isFileExpired } from "../db.js";
import { isValidFileId } from "../utils/id.js";
import { resolveContentType } from "../utils/mime.js";
import type { StorageAdapter } from "../storage/index.js";

function contentDisposition(filename: string, attachment: boolean): string {
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  const type = attachment ? "attachment" : "inline";
  return `${type}; filename="${filename.replace(/"/g, "_")}"; filename*=UTF-8''${encoded}`;
}

export async function registerDownloadRoutes(
  app: FastifyInstance,
  storage: StorageAdapter,
): Promise<void> {
  app.get(
    "/d/:id",
    {
      config: {
        rateLimit: {
          max: config.rateLimit.downloadMax,
          timeWindow: config.rateLimit.downloadWindowMs,
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      if (!isValidFileId(id)) {
        return reply.status(404).type("text/html").send(renderDownloadError());
      }

      const record = getFileById(id);
      if (!record) {
        return reply.status(404).type("text/html").send(renderDownloadError());
      }
      if (isFileExpired(record)) {
        return reply.status(410).type("text/html").send(renderDownloadError("expired"));
      }

      const object = await storage.getStream(id);
      if (!object) {
        return reply.status(404).type("text/html").send(renderDownloadError());
      }

      const contentType = resolveContentType(record.mime_type, record.filename);

      reply.header("Content-Type", contentType);
      reply.header(
        "Content-Disposition",
        contentDisposition(record.filename, true),
      );
      if (object.size > 0) {
        reply.header("Content-Length", String(object.size));
      }
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("Cache-Control", "private, no-store");

      return reply.send(object.stream);
    },
  );
}

function renderDownloadError(kind?: "expired"): string {
  const title = kind === "expired" ? "File expired" : "Download error";
  const body =
    kind === "expired"
      ? "This file is no longer available."
      : "The file could not be downloaded.";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1><p>${body}</p><p><a href="/">Upload a file</a></p></body></html>`;
}
