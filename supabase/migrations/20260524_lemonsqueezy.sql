-- Add Lemon Squeezy subscription fields
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id       TEXT,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_subscription_id   TEXT,
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_portal_url TEXT;

CREATE INDEX IF NOT EXISTS idx_users_lemonsqueezy_subscription_id
  ON users (lemonsqueezy_subscription_id)
  WHERE lemonsqueezy_subscription_id IS NOT NULL;
