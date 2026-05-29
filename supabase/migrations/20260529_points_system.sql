ALTER TABLE users
  ADD COLUMN IF NOT EXISTS points              INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin_date  DATE,
  ADD COLUMN IF NOT EXISTS weekly_bonus_msgs  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_expires_at   TIMESTAMPTZ;

-- Ensure points never goes negative or above 150
ALTER TABLE users
  ADD CONSTRAINT chk_points CHECK (points >= 0 AND points <= 150);
