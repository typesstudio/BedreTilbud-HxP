-- Step 5.1: Add notification status tracking to company_comparisons
-- Tracks email notification separately from comparison status
-- Comparison can be "completed" even if notification "failed"

ALTER TABLE company_comparisons 
ADD COLUMN IF NOT EXISTS notification_status TEXT DEFAULT 'pending';

ALTER TABLE company_comparisons 
ADD COLUMN IF NOT EXISTS notification_error TEXT;

-- Set existing completed comparisons with notified_at to 'sent'
UPDATE company_comparisons 
SET notification_status = 'sent' 
WHERE notified_at IS NOT NULL AND notification_status IS NULL;

-- Set existing completed comparisons without notified_at to 'pending'
UPDATE company_comparisons 
SET notification_status = 'pending' 
WHERE notified_at IS NULL AND notification_status IS NULL;

-- Create index for notification status queries
CREATE INDEX IF NOT EXISTS company_comparisons_notification_status_idx 
ON company_comparisons(notification_status);
