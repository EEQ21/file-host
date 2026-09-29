import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import { config } from "../config.js";
import type { PutFileOptions, StorageAdapter } from "./types.js";

export function createS3Storage(): StorageAdapter {
  const client = new S3Client({
    region: config.s3.region,
    endpoint: config.s3.endpoint || undefined,
    credentials:
      config.s3.accessKeyId && config.s3.secretAccessKey
        ? {
            accessKeyId: config.s3.accessKeyId,
            secretAccessKey: config.s3.secretAccessKey,
          }
        : undefined,
    forcePathStyle: Boolean(config.s3.endpoint),
  });
  const bucket = config.s3.bucket;

  return {
    async put(id: string, body: Readable, options?: PutFileOptions) {
      let size = 0;
      body.on("data", (chunk: Buffer) => {
        size += chunk.length;
        options?.onBytesWritten?.(size);
      });
      if (options?.signal) {
        const onAbort = () => body.destroy(new Error("upload_aborted"));
        if (options.signal.aborted) onAbort();
        else options.signal.addEventListener("abort", onAbort, { once: true });
      }
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: id,
          Body: body,
          ContentType: options?.mimeType ?? "application/octet-stream",
        },
        queueSize: 4,
        partSize: 8 * 1024 * 1024,
        leavePartsOnError: false,
      });
      await upload.done();
      return { size };
    },

    async getStream(id: string) {
      try {
        const out = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: id }),
        );
        if (!out.Body) return null;
        const stream = out.Body as Readable;
        const size = Number(out.ContentLength ?? 0);
        return { stream, size };
      } catch {
        return null;
      }
    },

    async delete(id: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: id }));
    },
  };
}
