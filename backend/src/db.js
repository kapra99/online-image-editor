import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/editor.db');

let db;

export function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(path.join(__dirname, '../../uploads'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, '../../processed'), { recursive: true });

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      width INTEGER,
      height INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS edit_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      operation TEXT NOT NULL,
      params TEXT NOT NULL,
      result_filename TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    );
  `);

  console.log('Database initialised at', DB_PATH);
}

export function getDb() {
  return db;
}
