-- Step 1.3: Add document kind classification fields
-- Allows classifying documents as "insurance_policy" or "unknown"

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS document_kind TEXT DEFAULT 'insurance_policy';

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS document_kind_confidence INTEGER;

-- Create index for filtering by document kind
CREATE INDEX IF NOT EXISTS documents_document_kind_idx ON documents(document_kind);

-- Set existing documents to 'insurance_policy' (they were all uploaded as policies)
UPDATE documents SET document_kind = 'insurance_policy' WHERE document_kind IS NULL;
