import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';

// 确保数据库目录存在
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 数据库初始化（better-sqlite3 同步驱动）
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    reputation REAL DEFAULT 0.5,
    total_promises INTEGER DEFAULT 0,
    fulfilled_promises INTEGER DEFAULT 0,
    capital_total INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS game_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    final_capital INTEGER DEFAULT 0,
    reputation_change REAL DEFAULT 0,
    rounds INTEGER DEFAULT 0,
    ranking INTEGER DEFAULT 0,
    played_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_game_records_user ON game_records(user_id);
`);

export { db };
