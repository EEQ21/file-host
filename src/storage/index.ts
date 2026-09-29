import { config } from "../config.js";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";
import type { StorageAdapter } from "./types.js";

export function createStorage(): StorageAdapter {
  if (config.storageType === "s3") {
    return createS3Storage();
  }
  return createLocalStorage(config.localStoragePath);
}

export type { StorageAdapter } from "./types.js";
