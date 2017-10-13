BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS `images` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`token`	TEXT NOT NULL UNIQUE,
	`extension`	TEXT,
	`filename`	TEXT,
	`mime`	TEXT NOT NULL,
	`deletion_token`	TEXT UNIQUE,
	`access_type`	INTEGER NOT NULL,
	`access_token`	TEXT
);
CREATE TABLE IF NOT EXISTS `auth_tokens` (
	`id`	INTEGER PRIMARY KEY AUTOINCREMENT,
	`token`	TEXT NOT NULL UNIQUE
);
INSERT INTO `auth_tokens` VALUES (1,'your-auth-token');
COMMIT;
