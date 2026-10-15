-- High scores. No IP addresses or other personal data are stored.
CREATE TABLE scores (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	initials TEXT NOT NULL CHECK (length(initials) = 3),
	score INTEGER NOT NULL CHECK (score >= 0),
	level INTEGER NOT NULL CHECK (level >= 1),
	rows INTEGER NOT NULL CHECK (rows >= 0),
	chains INTEGER NOT NULL CHECK (chains >= 0),
	longest_chain INTEGER NOT NULL CHECK (longest_chain >= 0),
	-- How long the game took, for checking it was played at normal speed.
	duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
	-- Which version of the piece rules was used: scores are only compared within a version.
	generator_version INTEGER NOT NULL,
	-- 1 if tips (an assist) were on for the game.
	tips INTEGER NOT NULL CHECK (tips IN (0, 1)),
	-- 1 if the game was played offline and submitted later (less trustworthy).
	offline INTEGER NOT NULL DEFAULT 0 CHECK (offline IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fast "top scores" lookups for each version of the piece rules.
CREATE INDEX scores_by_version_and_score ON scores (generator_version, score DESC);