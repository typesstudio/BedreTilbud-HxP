-- Add file_hash column to documents table for duplicate detection
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- Create index for efficient duplicate lookup by userId and fileHash
CREATE INDEX IF NOT EXISTS documents_user_id_file_hash_idx ON documents(user_id, file_hash);
