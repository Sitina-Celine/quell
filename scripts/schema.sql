-- Quell funnel analytics: one table of events, one of email leads.

CREATE TABLE IF NOT EXISTS events (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id   TEXT        NOT NULL,
  event        TEXT        NOT NULL,
  variant      TEXT,
  utm_source   TEXT,
  utm_campaign TEXT,
  value_cents  INTEGER     NOT NULL DEFAULT 0,
  meta         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_demo      BOOLEAN     NOT NULL DEFAULT false,
  dedupe_key   TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS events_created_idx ON events (created_at);
CREATE INDEX IF NOT EXISTS events_event_idx ON events (event, session_id);

CREATE TABLE IF NOT EXISTS leads (
  email       TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  session_id  TEXT,
  variant     TEXT,
  utm_source  TEXT
);
