-- Initials may now be 1 to 3 characters: letters, spaces or full stops.
-- SQLite can't change a CHECK rule in place, so the table is rebuilt and the scores copied across.
CREATE TABLE scores_new (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	initials TEXT NOT NULL CHECK (length(initials) BETWEEN 1 AND 3),
	score INTEGER NOT NULL CHECK (score >= 0),
	level INTEGER NOT NULL CHECK (level >= 1),
	rows INTEGER NOT NULL CHECK (rows >= 0),
	chains INTEGER NOT NULL CHECK (chains >= 0),
	longest_chain INTEGER NOT NULL CHECK (longest_chain >= 0),
	duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
	generator_version INTEGER NOT NULL,
	tips INTEGER NOT NULL CHECK (tips IN (0, 1)),
	offline INTEGER NOT NULL DEFAULT 0 CHECK (offline IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO scores_new SELECT * FROM scores;
DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;
CREATE INDEX scores_by_version_and_score ON scores (generator_version, score DESC);

-- Blocked entries are letters only (spaces and full stops are ignored when checking), 1 to 3 long.
DROP TABLE blocked_initials;
CREATE TABLE blocked_initials (
	initials TEXT PRIMARY KEY CHECK (length(initials) BETWEEN 1 AND 3)
);