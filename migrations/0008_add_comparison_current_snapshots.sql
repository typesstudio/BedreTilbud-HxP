-- Step 5.3: Frozen Current Policy Snapshots per Comparison
-- When a comparison is requested, we freeze the user's current policies at that moment
-- This ensures historical stability - even if user updates policies later, comparison still references originals

CREATE TABLE IF NOT EXISTS comparison_current_snapshots (
  id VARCHAR DEFAULT gen_random_uuid() PRIMARY KEY,
  comparison_id VARCHAR NOT NULL REFERENCES company_comparisons(id),
  policy_snapshot_id VARCHAR NOT NULL REFERENCES policy_snapshots(id),
  policy_type TEXT NOT NULL,
  company_name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comparison_current_snapshots_comparison_id_idx ON comparison_current_snapshots(comparison_id);
CREATE INDEX IF NOT EXISTS comparison_current_snapshots_policy_snapshot_id_idx ON comparison_current_snapshots(policy_snapshot_id);
CREATE INDEX IF NOT EXISTS comparison_current_snapshots_comparison_type_idx ON comparison_current_snapshots(comparison_id, policy_type);
