-- Security Fixes Migration
-- Run this in your Supabase SQL Editor
-- Run each section separately if you get errors

-- =============================================
-- SECTION 1: Add new columns to users table
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS scheduled_plan TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_timezone TEXT;

-- =============================================
-- SECTION 2: Create atomic message increment function
-- =============================================

CREATE OR REPLACE FUNCTION increment_messages_used_today(user_id_param UUID, daily_limit INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  user_tz TEXT;
  actual_count INTEGER;
  today_start TIMESTAMPTZ;
  today_end TIMESTAMPTZ;
BEGIN
  -- Lock the user row to prevent concurrent modifications
  SELECT COALESCE(reset_timezone, timezone, 'UTC')
  INTO user_tz
  FROM users
  WHERE id = user_id_param
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Validate timezone; fall back to UTC if invalid
  BEGIN
    PERFORM NOW() AT TIME ZONE user_tz;
  EXCEPTION WHEN OTHERS THEN
    user_tz := 'UTC';
  END;

  -- Calculate today's start/end boundaries in user's timezone
  today_start := ((NOW() AT TIME ZONE user_tz)::date)::timestamp AT TIME ZONE user_tz;
  today_end := today_start + INTERVAL '1 day';

  -- Count ACTUAL user messages sent today from the messages table
  -- This is the single source of truth — no more drifting counters
  SELECT COUNT(*)
  INTO actual_count
  FROM messages m
  JOIN chats c ON c.id = m.chat_id
  WHERE c.user_id = user_id_param
    AND m.role = 'user'
    AND m.created_at >= today_start
    AND m.created_at < today_end;

  -- Check limit based on real count
  IF actual_count >= daily_limit THEN
    -- Sync counter to reality and reject
    UPDATE users
    SET messages_used_today = actual_count,
        last_reset_date = NOW()
    WHERE id = user_id_param;
    RETURN FALSE;
  END IF;

  -- Allow message — set counter to actual + 1 (counting the message about to be saved)
  UPDATE users
  SET messages_used_today = actual_count + 1,
      last_reset_date = NOW()
  WHERE id = user_id_param;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECTION 3: Create session version increment function
-- =============================================

CREATE OR REPLACE FUNCTION increment_session_version(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET session_version = COALESCE(session_version, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECTION 4: Create total messages increment function
-- =============================================

CREATE OR REPLACE FUNCTION increment_total_messages(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET total_messages = COALESCE(total_messages, 0) + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECTION 5: Create billing index
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_billing
ON users (current_period_end)
WHERE plan != 'Free' AND current_period_end IS NOT NULL;

-- =============================================
-- SECTION 6: Create webhook events table
-- =============================================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  event_type TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events (processed_at);

-- =============================================
-- SECTION 7: Create webhook deduplication function
-- =============================================

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

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECTION 8: Create webhook cleanup function
-- =============================================

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

-- =============================================
-- SECTION 9: Add unique constraints (run separately if errors)
-- These may fail if duplicates exist or constraints already exist
-- =============================================

-- Uncomment and run these separately if needed:
-- ALTER TABLE pending_users ADD CONSTRAINT pending_users_email_unique UNIQUE (email);
-- ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
