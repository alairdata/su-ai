-- Track subscription history so MRR chart survives downgrades/cancellations

-- Preserve the last paid plan before downgrade (never gets reset to Free)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_paid_plan TEXT;

-- Track when the current/last subscription started
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

-- Full subscription events log (going forward)
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'subscribed', 'renewed', 'cancelled', 'expired', 'upgraded', 'downgraded'
  plan TEXT NOT NULL,
  amount_usd DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_events_user_id_idx ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS subscription_events_created_at_idx ON subscription_events(created_at);
