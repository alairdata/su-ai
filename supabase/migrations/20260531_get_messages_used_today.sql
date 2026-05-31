CREATE OR REPLACE FUNCTION get_messages_used_today(user_id_param UUID, user_tz_param TEXT DEFAULT 'UTC')
RETURNS INTEGER AS $$
DECLARE
  actual_count INTEGER;
  today_start TIMESTAMPTZ;
  today_end TIMESTAMPTZ;
  safe_tz TEXT;
BEGIN
  -- Validate timezone
  BEGIN
    PERFORM NOW() AT TIME ZONE user_tz_param;
    safe_tz := user_tz_param;
  EXCEPTION WHEN OTHERS THEN
    safe_tz := 'UTC';
  END;

  today_start := ((NOW() AT TIME ZONE safe_tz)::date)::timestamp AT TIME ZONE safe_tz;
  today_end   := today_start + INTERVAL '1 day';

  SELECT COUNT(*)
  INTO actual_count
  FROM messages m
  JOIN chats c ON c.id = m.chat_id
  WHERE c.user_id = user_id_param
    AND m.role = 'user'
    AND m.created_at >= today_start
    AND m.created_at < today_end;

  RETURN COALESCE(actual_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
