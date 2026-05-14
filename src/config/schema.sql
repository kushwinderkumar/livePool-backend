-- ============================================================
--  PollCraft Database Schema
--  PostgreSQL 15+
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- gen_random_uuid() is built-in from PostgreSQL 13+
-- No extra extension needed.

-- ── Tables ───────────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255)  UNIQUE NOT NULL,
  name          VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Polls
CREATE TABLE IF NOT EXISTS polls (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(500)  NOT NULL,
  description  TEXT,
  is_anonymous BOOLEAN       NOT NULL DEFAULT false,
  expires_at   TIMESTAMPTZ,                          -- NULL = no expiry
  is_published BOOLEAN       NOT NULL DEFAULT false, -- results visible publicly
  is_active    BOOLEAN       NOT NULL DEFAULT true,  -- accepting responses
  public_link  VARCHAR(100)  UNIQUE NOT NULL,        -- short share token
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Questions  (single-option selection per question)
CREATE TABLE IF NOT EXISTS questions (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id      UUID     NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  text         TEXT     NOT NULL,
  is_mandatory BOOLEAN  NOT NULL DEFAULT true,
  order_index  INTEGER  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Options  (choices for each question)
CREATE TABLE IF NOT EXISTS options (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID         NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text         VARCHAR(500) NOT NULL,
  order_index  INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Responses  (one row per poll submission)
CREATE TABLE IF NOT EXISTS responses (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id        UUID        NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  respondent_id  UUID        REFERENCES users(id) ON DELETE SET NULL, -- NULL = anonymous
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address     VARCHAR(45)                                          -- IPv4 or IPv6
);

-- Answers  (one row per question answered inside a response)
CREATE TABLE IF NOT EXISTS answers (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id  UUID  NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id  UUID  NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_id    UUID  NOT NULL REFERENCES options(id)   ON DELETE CASCADE,
  UNIQUE (response_id, question_id)   -- one answer per question per submission
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_polls_creator       ON polls(creator_id);
CREATE INDEX IF NOT EXISTS idx_polls_public_link   ON polls(public_link);
CREATE INDEX IF NOT EXISTS idx_questions_poll      ON questions(poll_id);
CREATE INDEX IF NOT EXISTS idx_options_question    ON options(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_poll      ON responses(poll_id);
CREATE INDEX IF NOT EXISTS idx_responses_respondent ON responses(respondent_id);
CREATE INDEX IF NOT EXISTS idx_answers_response    ON answers(response_id);
CREATE INDEX IF NOT EXISTS idx_answers_question    ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_option      ON answers(option_id);

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_polls_updated_at ON polls;
CREATE TRIGGER trg_polls_updated_at
  BEFORE UPDATE ON polls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
