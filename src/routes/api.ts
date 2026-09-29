import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { insertFile, getFileById, isFileExpired } from "../db.js";
import { generateFileId, isValidFileId } from "../utils/id.js";
import { sanitizeFilename } from "../utils/filename.js";
import type { StorageAdapter } from "../storage/index.js";

function fileUrls(id: string) {
  return {
    url: `${config.appUrl}/${id}`,
    downloadUrl: `${config.appUrl}/d/${id}`,
  };
}

export async function registerApiRoutes(
  app: FastifyInstance,
  storage: StorageAdapter,
): Promise<void> {
  app.post(
    "/api/upload",
    {
      config: {
        rateLimit: {
          max: config.rateLimit.uploadMax,
          timeWindow: config.rateLimit.uploadWindowMs,
        },
      },
    },
    async (request, reply) => {
      let filePart;
      try {
        filePart = await request.file({
          limits: { files: 1, fileSize: config.maxFileSize },
        });
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "FST_REQ_FILE_TOO_LARGE") {
          return reply.status(413).send({
            error: "file_too_large",
            message: `Maximum file size is ${config.maxFileSize} bytes.`,
          });
        }
        return reply.status(400).send({
          error: "invalid_upload",
          message: "Invalid upload request.",
        });
      }

      if (!filePart) {
        return reply.status(400).send({
          error: "invalid_upload",
          message: "No file provided.",
        });
      }

      const filename = sanitizeFilename(filePart.filename || "download");
      const mimeType = filePart.mimetype || null;
      const id = generateFileId();

      let storedSize = 0;
      try {
        const result = await storage.put(id, filePart.file, {
          mimeType,
          onBytesWritten: (bytes) => {
            storedSize = bytes;
            if (bytes > config.maxFileSize) {
              filePart.file.destroy(new Error("file_too_large"));
            }
          },
        });
        storedSize = result.size;
      } catch (err: unknown) {
        await storage.delete(id).catch(() => {});
        const msg = err instanceof Error ? err.message : "";
        if (msg === "upload_aborted" || msg === "file_too_large") {
          return reply.status(413).send({
            error: "file_too_large",
            message: `Maximum file size is ${config.maxFileSize} bytes.`,
          });
        }
        request.log.error(err);
        return reply.status(500).send({
          error: "upload_failed",
          message: "Upload failed. Please try again.",
        });
      }

      if (storedSize > config.maxFileSize) {
        await storage.delete(id).catch(() => {});
        return reply.status(413).send({
          error: "file_too_large",
          message: `Maximum file size is ${config.maxFileSize} bytes.`,
        });
      }

      if (storedSize === 0) {
        await storage.delete(id).catch(() => {});
        return reply.status(400).send({
          error: "invalid_upload",
          message: "Empty file.",
        });
      }

      insertFile({
        id,
        filename,
        size: storedSize,
        mimeType,
      });

      const urls = fileUrls(id);
      return reply.status(201).send({
        id,
        filename,
        size: storedSize,
        ...urls,
      });
    },
  );

  app.get("/api/files/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidFileId(id)) {
      return reply.status(404).send({
        error: "not_found",
        message: "File not found.",
      });
    }
    const record = getFileById(id);
    if (!record || isFileExpired(record)) {
      return reply.status(404).send({
        error: record && isFileExpired(record) ? "expired" : "not_found",
        message:
          record && isFileExpired(record)
            ? "This file has expired."
            : "File not found.",
      });
    }
    const urls = fileUrls(id);
    return reply.send({
      id: record.id,
      filename: record.filename,
      size: record.size,
      mimeType: record.mime_type,
      createdAt: record.created_at,
      expiresAt: record.expires_at,
      ...urls,
    });
  });
}
