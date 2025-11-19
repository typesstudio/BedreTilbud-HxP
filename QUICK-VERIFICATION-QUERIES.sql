-- ================================================================================
-- BEDRETILBUD - Quick Verification Queries
-- ================================================================================
-- Use these queries to verify the debug script findings
-- User: e85ec3b9-e354-4c49-9f68-194830e356af (hello@vyork.dk)
-- Offer Company: Alm. Brand (abd44932-e5b2-4fda-a463-e75fd46c1ccc)
-- ================================================================================

-- ================================================================================
-- QUERY 1: Find All Health Check Mismatches
-- ================================================================================
-- Expected: 10 rows showing policy_type mismatches
-- This confirms the mislabeling issue

SELECT 
  hc.id as health_check_id,
  hc.snapshot_id,
  os.policy_type as snapshot_policy_type,
  hc.policy_type as healthcheck_policy_type,
  os.document_type as doc_type,
  c.name as company_name,
  hc.analysis_result->'whatsIncluded'->0 as first_coverage,
  hc.analysis_result->'whatsIncluded'->1 as second_coverage
FROM health_checks hc
JOIN offer_snapshots os ON hc.snapshot_id = os.id
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND hc.policy_type != os.policy_type
ORDER BY os.document_type, os.policy_type;

-- ================================================================================
-- QUERY 2: Find Snapshots Missing structured_policy
-- ================================================================================
-- Expected: 8 rows
-- Critical: Shows current indbo and ulykke missing extraction data

SELECT 
  os.id as snapshot_id,
  d.id as document_id,
  d.file_name,
  os.document_type as doc_type,
  os.policy_type,
  c.name as company_name,
  CASE 
    WHEN os.structured_policy IS NULL THEN '❌ MISSING'
    ELSE '✓'
  END as has_structured
FROM offer_snapshots os
JOIN documents d ON os.document_id = d.id
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND os.structured_policy IS NULL
ORDER BY os.document_type, os.policy_type;

-- ================================================================================
-- QUERY 3: Verify Current User Policies
-- ================================================================================
-- Shows the 3 current policies with their data quality status

SELECT 
  os.id as snapshot_id,
  os.policy_type,
  c.name as company_name,
  CASE 
    WHEN os.structured_policy IS NULL THEN '❌ NO'
    ELSE '✅ YES'
  END as has_structured,
  (
    SELECT COUNT(*) 
    FROM health_checks hc 
    WHERE hc.snapshot_id = os.id
  ) as health_check_count,
  jsonb_array_length(
    COALESCE(os.structured_policy->'mainCoverages', '[]'::jsonb)
  ) as main_coverage_count
FROM offer_snapshots os
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND os.document_type = 'current'
ORDER BY os.policy_type;

-- ================================================================================
-- QUERY 4: Verify Alm. Brand Offer Policies
-- ================================================================================
-- Shows the 3 offer policies from Alm. Brand

SELECT 
  os.id as snapshot_id,
  os.policy_type,
  c.name as company_name,
  CASE 
    WHEN os.structured_policy IS NULL THEN '❌ NO'
    ELSE '✅ YES'
  END as has_structured,
  (
    SELECT COUNT(*) 
    FROM health_checks hc 
    WHERE hc.snapshot_id = os.id
  ) as health_check_count,
  jsonb_array_length(
    COALESCE(os.structured_policy->'mainCoverages', '[]'::jsonb)
  ) as main_coverage_count
FROM offer_snapshots os
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND os.document_type = 'offer'
  AND c.id = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc'
ORDER BY os.policy_type;

-- ================================================================================
-- QUERY 5: Inspect Specific Mislabeled Snapshots
-- ================================================================================
-- Deep dive into the 3 critical snapshots for Alm. Brand comparison

SELECT 
  os.id as snapshot_id,
  os.document_type,
  os.policy_type as db_policy_type,
  c.name as company,
  hc.policy_type as health_check_policy_type,
  jsonb_array_length(hc.analysis_result->'whatsIncluded') as coverage_count,
  hc.analysis_result->'whatsIncluded'->0 as coverage_1,
  hc.analysis_result->'whatsIncluded'->1 as coverage_2,
  hc.analysis_result->'whatsIncluded'->2 as coverage_3
FROM offer_snapshots os
LEFT JOIN companies c ON os.company_id = c.id
LEFT JOIN health_checks hc ON hc.snapshot_id = os.id
WHERE os.id IN ('4f1d13ae', '9ad74ada', '2aefbdb7', 'f28e4d53')
ORDER BY os.document_type, os.policy_type;

-- ================================================================================
-- QUERY 6: Verify Comparison Results
-- ================================================================================
-- Shows the final comparison JSON with coverage row counts

SELECT 
  cc.id as comparison_id,
  cc.status,
  cc.created_at,
  cc.updated_at,
  c.name as offer_company,
  jsonb_array_length(cc.comparison_result->'policyComparisons') as policy_count,
  cc.comparison_result->'policyComparisons'->0->>'policyType' as policy_1_type,
  jsonb_array_length(cc.comparison_result->'policyComparisons'->0->'coverageComparison'->'rows') as policy_1_rows,
  cc.comparison_result->'policyComparisons'->1->>'policyType' as policy_2_type,
  jsonb_array_length(cc.comparison_result->'policyComparisons'->1->'coverageComparison'->'rows') as policy_2_rows,
  cc.comparison_result->'policyComparisons'->2->>'policyType' as policy_3_type,
  jsonb_array_length(cc.comparison_result->'policyComparisons'->2->'coverageComparison'->'rows') as policy_3_rows
FROM company_comparisons cc
LEFT JOIN companies c ON cc.offer_company_id = c.id
WHERE cc.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND cc.offer_company_id = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc'
ORDER BY cc.created_at DESC
LIMIT 1;

-- ================================================================================
-- QUERY 7: Health Check to Snapshot FK Audit
-- ================================================================================
-- Verify that health_checks.snapshot_id points to correct policy_type
-- This helps identify if the FK relationship is broken

SELECT 
  hc.id as health_check_id,
  hc.snapshot_id,
  hc.policy_type as hc_policy_type,
  os.policy_type as snapshot_policy_type,
  os.document_type,
  c.name as company,
  CASE 
    WHEN hc.policy_type = os.policy_type THEN '✅ MATCH'
    ELSE '❌ MISMATCH'
  END as status,
  hc.created_at
FROM health_checks hc
JOIN offer_snapshots os ON hc.snapshot_id = os.id
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
ORDER BY status DESC, os.document_type, hc.policy_type;

-- ================================================================================
-- QUERY 8: Document → Snapshot → Health Check Chain
-- ================================================================================
-- Full audit trail for Alm. Brand offer document

SELECT 
  d.id as document_id,
  d.file_name,
  d.document_type as doc_type,
  os.id as snapshot_id,
  os.policy_type as snapshot_type,
  hc.id as health_check_id,
  hc.policy_type as health_check_type,
  CASE 
    WHEN os.structured_policy IS NULL THEN '❌'
    ELSE '✅'
  END as has_structured,
  CASE 
    WHEN hc.policy_type = os.policy_type THEN '✅'
    ELSE '❌'
  END as types_match
FROM documents d
LEFT JOIN offer_snapshots os ON os.document_id = d.id
LEFT JOIN health_checks hc ON hc.snapshot_id = os.id
WHERE d.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND d.company_id = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc'
ORDER BY os.policy_type;

-- ================================================================================
-- QUERY 9: All Mislabeled Snapshots (Full Details)
-- ================================================================================
-- Complete list of all 10 mislabeled snapshots with actionable data

SELECT 
  hc.snapshot_id,
  os.document_type,
  c.name as company,
  hc.policy_type as health_check_says,
  os.policy_type as snapshot_says,
  hc.analysis_result->'whatsIncluded'->0 as coverage_1,
  hc.analysis_result->'whatsIncluded'->1 as coverage_2,
  '-- UPDATE health_checks SET policy_type = ''' || 
    CASE 
      WHEN hc.analysis_result->'whatsIncluded'->>0 ILIKE '%invaliditet%' THEN 'ulykke'
      WHEN hc.analysis_result->'whatsIncluded'->>0 ILIKE '%indbo%' THEN 'indbo'
      WHEN hc.analysis_result->'whatsIncluded'->>0 ILIKE '%brand%' THEN 'hus'
      ELSE 'UNKNOWN'
    END || 
  ''' WHERE snapshot_id = ''' || hc.snapshot_id || ''';' as suggested_fix
FROM health_checks hc
JOIN offer_snapshots os ON hc.snapshot_id = os.id
LEFT JOIN companies c ON os.company_id = c.id
WHERE os.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND hc.policy_type != os.policy_type
ORDER BY os.document_type, hc.policy_type;

-- ================================================================================
-- QUERY 10: Matcher Score Simulation
-- ================================================================================
-- See what scores the matcher would assign (if metadata existed)

SELECT 
  curr.id as current_snapshot,
  curr.policy_type,
  offer.id as offer_snapshot,
  curr.structured_policy->>'address' as curr_address,
  offer.structured_policy->>'address' as offer_address,
  curr.structured_policy->>'person' as curr_person,
  offer.structured_policy->>'person' as offer_person,
  curr.structured_policy->>'offerNumber' as curr_offer_num,
  offer.structured_policy->>'offerNumber' as offer_offer_num,
  CASE 
    WHEN curr.structured_policy IS NULL OR offer.structured_policy IS NULL 
    THEN 'score=0 (FALLBACK)'
    ELSE 'score=?' 
  END as match_status
FROM offer_snapshots curr
CROSS JOIN offer_snapshots offer
WHERE curr.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND offer.user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af'
  AND curr.document_type = 'current'
  AND offer.document_type = 'offer'
  AND curr.policy_type = offer.policy_type
  AND offer.company_id = 'abd44932-e5b2-4fda-a463-e75fd46c1ccc'
ORDER BY curr.policy_type;

-- ================================================================================
-- END OF VERIFICATION QUERIES
-- ================================================================================
-- Next Steps:
-- 1. Run Query 1 to confirm 10 mismatches
-- 2. Run Query 2 to confirm 8 missing structured_policy
-- 3. Run Query 6 to verify comparison has 0 rows for indbo/ulykke
-- 4. Use Query 9 to get suggested SQL fixes for mislabeled health checks
-- ================================================================================
