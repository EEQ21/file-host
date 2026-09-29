function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

const ONE_GB = 1073741824;

export const config = {
  port: envInt("PORT", 3000),
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  maxFileSize: envInt("MAX_FILE_SIZE", ONE_GB),
  fileExpirationDays: envInt("FILE_EXPIRATION_DAYS", 0),
  storageType: (process.env.STORAGE_TYPE ?? "local") as "local" | "s3",
  localStoragePath: process.env.LOCAL_STORAGE_PATH ?? "./storage",
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? "fike",
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  databasePath: process.env.DATABASE_PATH ?? "./data/fike.db",
  rateLimit: {
    uploadMax: envInt("RATE_LIMIT_UPLOAD_MAX", 20),
    uploadWindowMs: envInt("RATE_LIMIT_UPLOAD_WINDOW_MS", 3600000),
    downloadMax: envInt("RATE_LIMIT_DOWNLOAD_MAX", 120),
    downloadWindowMs: envInt("RATE_LIMIT_DOWNLOAD_WINDOW_MS", 60000),
  },
} as const;
