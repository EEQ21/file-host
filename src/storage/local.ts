import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import type { PutFileOptions, StorageAdapter } from "./types.js";

export function createLocalStorage(basePath: string): StorageAdapter {
  const objectPath = (id: string) => path.join(basePath, id);

  return {
    async put(id: string, body: Readable, options?: PutFileOptions) {
      await fsp.mkdir(basePath, { recursive: true });
      const dest = objectPath(id);
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
      await pipeline(body, fs.createWriteStream(dest));
      const stat = await fsp.stat(dest);
      return { size: stat.size };
    },

    async getStream(id: string) {
      const p = objectPath(id);
      try {
        await fsp.access(p);
        const stat = await fsp.stat(p);
        return { stream: fs.createReadStream(p), size: stat.size };
      } catch {
        return null;
      }
    },

    async delete(id: string) {
      try {
        await fsp.unlink(objectPath(id));
      } catch {
        /* ignore missing */
      }
    },
  };
}
