-- Add is_active column to policy_snapshots for version management (Step 1.2)
-- For "current" policies: is_active=true means this is THE active policy for this (userId, policyType)
-- When a new policy of same type is uploaded, old ones are set to is_active=false (archived)
ALTER TABLE policy_snapshots ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Indexes for efficient active policy lookups
CREATE INDEX IF NOT EXISTS policy_snapshots_user_id_kind_active_idx ON policy_snapshots(user_id, kind, is_active);
CREATE INDEX IF NOT EXISTS policy_snapshots_user_id_kind_type_active_idx ON policy_snapshots(user_id, kind, policy_type, is_active);
