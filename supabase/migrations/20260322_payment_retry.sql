-- Payment retry, grace period, and auto-downgrade columns
-- Adds retry tracking for failed recurring charges

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_end timestamptz;

-- Index for the cron job query that finds past_due and grace_period users
CREATE INDEX IF NOT EXISTS idx_users_subscription_status
  ON users (subscription_status)
  WHERE subscription_status IN ('past_due', 'grace_period');
