-- BabyShaneAdventures — local development schema (Node built-in SQLite).
-- Mirrors schema.mariadb.sql exactly. MariaDB is used whenever DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  rpm_avatar_url TEXT,
  avatar_config TEXT,
  coins INTEGER NOT NULL DEFAULT 350,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Rooms (
  id TEXT PRIMARY KEY,
  socket_instance_ids TEXT,
  theme TEXT NOT NULL DEFAULT 'meadow',
  world_state TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS Inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  items TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (room_id, user_id)
);
