
-- Security Fixes Migration
-- Run this in your Supabase SQL Editor

-- 1. Add session_version column for session invalidation on password reset
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;

-- 1b. Add scheduled_plan column for tracking downgrade target
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_plan TEXT;

-- 1c. Add reset_timezone column for preventing timezone manipulation
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_timezone TEXT;

-- 2. Function to atomically increment messages_used_today with limit check
-- Returns true if increment succeeded, false if limit would be exceeded
CREATE OR REPLACE FUNCTION increment_messages_used_today(user_id_param UUID, daily_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
BEGIN
  -- Get current count with row lock
  SELECT messages_used_today INTO current_count
  FROM users
  WHERE id = user_id_param
  FOR UPDATE;

  -- Check if limit would be exceeded
  IF current_count >= daily_limit THEN
    RETURN FALSE;
  END IF;

  -- Increment the count
  UPDATE users
  SET messages_used_today = messages_used_today + 1
  WHERE id = user_id_param;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to increment session_version (invalidates all existing sessions)
CREATE OR REPLACE FUNCTION increment_session_version(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET session_version = COALESCE(session_version, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 4. Function to increment total_messages (already may exist)
CREATE OR REPLACE FUNCTION increment_total_messages(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET total_messages = COALESCE(total_messages, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 5. Add index for billing cron job efficiency
CREATE INDEX IF NOT EXISTS idx_users_billing
ON users (current_period_end)
WHERE plan != 'Free' AND current_period_end IS NOT NULL;

-- 6. Add unique constraint on pending_users email to prevent race conditions
ALTER TABLE pending_users ADD CONSTRAINT IF NOT EXISTS pending_users_email_unique UNIQUE (email);

-- 7. Add unique constraint on users email
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_email_unique UNIQUE (email);

-- 8. Create webhook_events table for deduplication (prevents replay attacks)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'stripe' or 'paystack'
  event_type TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, provider)
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events (processed_at);

-- Function to check and record webhook (atomic operation)
-- Returns TRUE if this is a new event, FALSE if already processed
CREATE OR REPLACE FUNCTION check_and_record_webhook(
  p_event_id TEXT,
  p_provider TEXT,
  p_event_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO webhook_events (event_id, provider, event_type)
  VALUES (p_event_id, p_provider, p_event_type)
  ON CONFLICT (event_id, provider) DO NOTHING;

  -- Return true if insert succeeded (new event), false if it was a duplicate
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old webhook events (run periodically, keeps last 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_events
  WHERE processed_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
