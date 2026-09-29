import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export interface FileRecord {
  id: string;
  filename: string;
  size: number;
  mime_type: string | null;
  created_at: string;
  expires_at: string | null;
}

let db: Database.Database;

export function initDb(): Database.Database {
  const dir = path.dirname(config.databasePath);
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(config.databasePath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_files_expires ON files(expires_at);
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!db) initDb();
  return db;
}

function expirationIso(): string | null {
  if (config.fileExpirationDays <= 0) return null;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + config.fileExpirationDays);
  return d.toISOString();
}

export function insertFile(record: {
  id: string;
  filename: string;
  size: number;
  mimeType: string | null;
}): FileRecord {
  const created_at = new Date().toISOString();
  const expires_at = expirationIso();
  getDb()
    .prepare(
      `INSERT INTO files (id, filename, size, mime_type, created_at, expires_at)
       VALUES (@id, @filename, @size, @mime_type, @created_at, @expires_at)`,
    )
    .run({
      id: record.id,
      filename: record.filename,
      size: record.size,
      mime_type: record.mimeType,
      created_at,
      expires_at,
    });
  return {
    id: record.id,
    filename: record.filename,
    size: record.size,
    mime_type: record.mimeType,
    created_at,
    expires_at,
  };
}

export function getFileById(id: string): FileRecord | null {
  const row = getDb()
    .prepare(`SELECT * FROM files WHERE id = ?`)
    .get(id) as FileRecord | undefined;
  return row ?? null;
}

export function isFileExpired(record: FileRecord): boolean {
  if (!record.expires_at) return false;
  return new Date(record.expires_at).getTime() <= Date.now();
}

export function deleteFileRecord(id: string): void {
  getDb().prepare(`DELETE FROM files WHERE id = ?`).run(id);
}

export function purgeExpiredFiles(): string[] {
  const now = new Date().toISOString();
  const rows = getDb()
    .prepare(`SELECT id FROM files WHERE expires_at IS NOT NULL AND expires_at <= ?`)
    .all(now) as { id: string }[];
  if (rows.length === 0) return [];
  const del = getDb().prepare(`DELETE FROM files WHERE id = ?`);
  const ids: string[] = [];
  for (const { id } of rows) {
    del.run(id);
    ids.push(id);
  }
  return ids;
}
