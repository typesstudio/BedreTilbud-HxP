-- Step 1.4: Add error_reason column to documents for tracking PDF processing failures
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_reason TEXT;

-- Add index for filtering by extraction status (for queries that filter failed documents)
CREATE INDEX IF NOT EXISTS documents_extraction_status_idx ON documents(extraction_status);
