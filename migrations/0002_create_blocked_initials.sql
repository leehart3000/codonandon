-- Initials that may not be used on the high-score table.
-- The list itself is deliberately kept out of the public repository:
-- entries are added directly to the database.
CREATE TABLE blocked_initials (
	initials TEXT PRIMARY KEY CHECK (length(initials) = 3)
);