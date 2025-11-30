-- Migration: Add magic_links and notifications tables for email notification system
-- Date: 2024-11-29

-- Magic links table for passwordless authentication
CREATE TABLE IF NOT EXISTS magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparison_id VARCHAR REFERENCES company_comparisons(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  redirect_path TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for magic_links
CREATE INDEX IF NOT EXISTS magic_links_token_idx ON magic_links(token);
CREATE INDEX IF NOT EXISTS magic_links_user_id_idx ON magic_links(user_id);
CREATE INDEX IF NOT EXISTS magic_links_expires_at_idx ON magic_links(expires_at);

-- Notifications table for logging email sends
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comparison_id VARCHAR REFERENCES company_comparisons(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_comparison_id_idx ON notifications(comparison_id);
CREATE INDEX IF NOT EXISTS notifications_status_idx ON notifications(status);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);

-- Add notified_at column to company_comparisons
ALTER TABLE company_comparisons ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
