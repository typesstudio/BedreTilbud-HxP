-- Migration: Add health_check_json column to policy_snapshots
-- Ticket: A (DB & Pipeline - Precomputed JSON)
-- Date: December 2025
-- Purpose: Store pre-computed health check results directly on policy snapshots
--          for instant reads without JOIN to health_checks table

-- Add health_check_json column to policy_snapshots (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'policy_snapshots' 
        AND column_name = 'health_check_json'
    ) THEN
        ALTER TABLE policy_snapshots 
        ADD COLUMN health_check_json jsonb;
        
        RAISE NOTICE 'Column health_check_json added to policy_snapshots';
    ELSE
        RAISE NOTICE 'Column health_check_json already exists in policy_snapshots';
    END IF;
END $$;

-- Add index for efficient querying of snapshots with health checks
CREATE INDEX IF NOT EXISTS policy_snapshots_health_check_exists_idx 
    ON policy_snapshots ((health_check_json IS NOT NULL));

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'policy_snapshots' 
    AND column_name = 'health_check_json';
