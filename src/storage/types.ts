import type { Readable } from "node:stream";

export interface PutFileOptions {
  mimeType?: string | null;
  onBytesWritten?: (bytes: number) => void;
  signal?: AbortSignal;
}

export interface StorageAdapter {
  put(id: string, body: Readable, options?: PutFileOptions): Promise<{ size: number }>;
  getStream(id: string): Promise<{ stream: Readable; size: number } | null>;
  delete(id: string): Promise<void>;
}
