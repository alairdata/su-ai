CREATE TABLE IF NOT EXISTS payment_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL,
  plan            TEXT,
  amount_usd      NUMERIC(10,2),
  status          TEXT,
  provider        TEXT DEFAULT 'lemonsqueezy',
  failure_reason  TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_events_user_id   ON payment_events (user_id);
CREATE INDEX idx_payment_events_type      ON payment_events (event_type);
CREATE INDEX idx_payment_events_created   ON payment_events (created_at DESC);
