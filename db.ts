import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const defaultDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ?? process.env.TMPDIR
  ?? "/tmp";
const dbPath = process.env.DB_PATH ?? path.join(defaultDir, "truco.sqlite");
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    chips INTEGER NOT NULL DEFAULT 0,
    bonus_chips INTEGER NOT NULL DEFAULT 0,
    bonus_locked INTEGER NOT NULL DEFAULT 0,
    deposits_total INTEGER NOT NULL DEFAULT 0,
    invite_code TEXT UNIQUE,
    referred_by TEXT,
    referral_bonus_given INTEGER NOT NULL DEFAULT 0,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT,
    privacy TEXT NOT NULL,
    mode TEXT NOT NULL,
    points INTEGER NOT NULL,
    economy TEXT NOT NULL,
    entry_fee INTEGER NOT NULL,
    allow_flor INTEGER NOT NULL,
    join_code_a TEXT,
    join_code_b TEXT,
    created_by TEXT NOT NULL,
    status TEXT NOT NULL,
    pot_total INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS room_members (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    team TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chips_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

const ensureColumn = (table: string, column: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
};

ensureColumn("users", "bonus_chips", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "bonus_locked", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "deposits_total", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "invite_code", "TEXT UNIQUE");
ensureColumn("users", "referred_by", "TEXT");
ensureColumn("users", "referral_bonus_given", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("users", "password_hash", "TEXT");

export default db;
