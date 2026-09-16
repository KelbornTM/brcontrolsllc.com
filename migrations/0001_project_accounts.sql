-- One versioned project document per verified Access user.
-- Only project names and drawing-element membership are stored in this first version.
CREATE TABLE IF NOT EXISTS studio_project_accounts (
  owner_id TEXT PRIMARY KEY,
  projects_json TEXT NOT NULL DEFAULT '[]',
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
