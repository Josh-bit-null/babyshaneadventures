-- BabyShaneAdventures — MariaDB / MySQL schema
-- Exactly three tables: Users, Rooms, Inventories.

CREATE TABLE IF NOT EXISTS Users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  display_name VARCHAR(48) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  rpm_avatar_url VARCHAR(1024) NULL,
  avatar_config JSON NULL,
  coins INT NOT NULL DEFAULT 350,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_uq (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per live room. socket_instance_ids tracks the Socket.IO instances
-- currently attached (one socket per user; duplicates are evicted server-side).
CREATE TABLE IF NOT EXISTS Rooms (
  id VARCHAR(64) NOT NULL,
  socket_instance_ids JSON NULL,
  theme VARCHAR(64) NOT NULL DEFAULT 'meadow',
  world_state JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- items = JSON array of {uid, sku, x, y, z, rx, ry, rz, scale, source}.
-- user_id = 0 is the shared room inventory (chore rewards visible to both).
CREATE TABLE IF NOT EXISTS Inventories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id VARCHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  items JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY inventories_room_user_uq (room_id, user_id),
  CONSTRAINT inventories_room_fk FOREIGN KEY (room_id) REFERENCES Rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
