import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { getFileById, isFileExpired } from "../db.js";
import { isValidFileId } from "../utils/id.js";
import {
  getPreviewKind,
  isPreviewContentType,
  resolveContentType,
} from "../utils/mime.js";
import type { StorageAdapter } from "../storage/index.js";

function contentDispositionInline(filename: string): string {
  const encoded = encodeURIComponent(filename).replace(/['()]/g, escape);
  return `inline; filename="${filename.replace(/"/g, "_")}"; filename*=UTF-8''${encoded}`;
}

export async function registerPreviewRoutes(
  app: FastifyInstance,
  storage: StorageAdapter,
): Promise<void> {
  app.get(
    "/v/:id",
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
        return reply.status(404).send({ error: "not_found" });
      }

      const record = getFileById(id);
      if (!record || isFileExpired(record)) {
        return reply.status(record && isFileExpired(record) ? 410 : 404).send({
          error: record && isFileExpired(record) ? "expired" : "not_found",
        });
      }

      const previewKind = getPreviewKind(record.filename);
      if (!previewKind) {
        return reply.status(404).send({ error: "no_preview" });
      }

      const contentType = resolveContentType(record.mime_type, record.filename);
      if (!isPreviewContentType(contentType, previewKind)) {
        return reply.status(404).send({ error: "no_preview" });
      }

      const object = await storage.getStream(id);
      if (!object) {
        return reply.status(404).send({ error: "not_found" });
      }

      reply.header("Content-Type", contentType);
      reply.header("Content-Disposition", contentDispositionInline(record.filename));
      if (object.size > 0) {
        reply.header("Content-Length", String(object.size));
      }
      reply.header("X-Content-Type-Options", "nosniff");
      reply.header("Cache-Control", "private, max-age=3600");

      return reply.send(object.stream);
    },
  );
}
