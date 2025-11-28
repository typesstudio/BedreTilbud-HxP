# Ticket A: DB & Pipeline Optimization

## Overview

This document describes the database schema changes and webhook endpoints for pre-computing and caching health check and comparison JSON data. This optimization reduces load times from 3-5 seconds to <500ms by eliminating repeated AI computation.

## Database Schema

### policy_snapshots.health_check_json

A new JSONB column `health_check_json` has been added to the `policy_snapshots` table:

```sql
-- Migration: 0001_add_health_check_json.sql
ALTER TABLE policy_snapshots 
ADD COLUMN IF NOT EXISTS health_check_json JSONB;
```

**Purpose**: Stores pre-computed health check results for instant reads.

**Schema** (TypeScript):
```typescript
interface HealthCheckJson {
  score: number;                    // 0-100 health score
  policyType: string;               // e.g., "indbo", "hus", "bil"
  annualPremium: number | null;     // Current yearly price
  coverages: CoverageRow[];         // Coverage analysis rows
  highlights: Highlight[];          // Key findings
  recommendations: Recommendation[];
  computedAt: string;               // ISO timestamp
}
```

## Webhook Endpoints

### POST /api/webhooks/health-check

Persists pre-computed health check JSON for a policy snapshot.

**Request Body**:
```json
{
  "policySnapshotId": "uuid-of-snapshot",
  "healthCheckJson": {
    "score": 78,
    "policyType": "indbo",
    "annualPremium": 2450,
    "coverages": [...],
    "highlights": [...],
    "recommendations": [...],
    "computedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "policySnapshotId": "uuid-of-snapshot",
  "message": "Health check JSON saved successfully"
}
```

**Error Responses**:
- `400`: Missing required fields
- `404`: Policy snapshot not found
- `500`: Internal error

### POST /api/webhooks/comparison

Persists pre-computed comparison JSON for a company comparison.

**Request Body**:
```json
{
  "comparisonId": "uuid-of-comparison",
  "comparisonJson": {
    "summary": {...},
    "policies": [...],
    "costAnalysis": {...},
    "computedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Response**:
```json
{
  "ok": true,
  "comparisonId": "uuid-of-comparison",
  "message": "Comparison JSON saved successfully"
}
```

## n8n Integration

### Workflow Pattern

1. **Trigger**: Document upload or scheduled batch job
2. **Fetch**: Get policy snapshot data via API
3. **Compute**: Call AI service to generate health check
4. **Persist**: POST to webhook endpoint

### Example n8n HTTP Request Node

```json
{
  "method": "POST",
  "url": "{{$env.API_BASE_URL}}/api/webhooks/health-check",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "policySnapshotId": "{{$node['Fetch Snapshot'].json.id}}",
    "healthCheckJson": "{{$node['Compute Health Check'].json}}"
  }
}
```

### Batch Processing Script

For backfilling existing snapshots:

```bash
# Get all snapshots without cached health checks
curl -X GET "https://your-api.replit.app/api/admin/policy-snapshots?missingHealthCheck=true"

# Process each snapshot
for snapshot in snapshots; do
  # Compute health check (via AI service)
  healthCheck=$(compute_health_check "$snapshot")
  
  # Persist via webhook
  curl -X POST "https://your-api.replit.app/api/webhooks/health-check" \
    -H "Content-Type: application/json" \
    -d "{\"policySnapshotId\": \"$snapshot_id\", \"healthCheckJson\": $healthCheck}"
done
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PRE-COMPUTATION FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Document Upload                                                │
│        │                                                         │
│        ▼                                                         │
│   OCR + Segmentation ──► PolicySnapshots created                │
│        │                                                         │
│        ▼                                                         │
│   n8n Trigger ──► AI Health Check Computation                   │
│        │                                                         │
│        ▼                                                         │
│   POST /api/webhooks/health-check                               │
│        │                                                         │
│        ▼                                                         │
│   health_check_json ◄── Stored in policy_snapshots              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         READ FLOW (FAST)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   User opens Health Check page                                   │
│        │                                                         │
│        ▼                                                         │
│   GET /api/policies/health-check/{snapshotId}                   │
│        │                                                         │
│        ▼                                                         │
│   Check: health_check_json exists?                              │
│        │                                                         │
│   ┌────┴────┐                                                   │
│   │         │                                                   │
│   YES       NO                                                  │
│   │         │                                                   │
│   ▼         ▼                                                   │
│ Return    Compute on-demand                                     │
│ cached    (fallback, slower)                                    │
│ (<50ms)   (3-5 seconds)                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Verification

### Check if column exists

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'policy_snapshots' 
AND column_name = 'health_check_json';
```

### Check cached data coverage

```sql
SELECT 
  COUNT(*) as total_snapshots,
  COUNT(health_check_json) as cached_snapshots,
  ROUND(100.0 * COUNT(health_check_json) / COUNT(*), 1) as cache_coverage_pct
FROM policy_snapshots;
```

### Test webhook endpoint

```bash
curl -X POST "http://localhost:5000/api/webhooks/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "policySnapshotId": "test-id",
    "healthCheckJson": {"score": 80, "test": true}
  }'
```

## Performance Metrics

| Metric | Before | After (cached) |
|--------|--------|----------------|
| Health Check Load | 3-5 seconds | <50ms |
| Overview Page Load | 5-10 seconds | <200ms |
| Database Queries | N+1 pattern | Single indexed read |

## Rollback

If needed, the column can be safely dropped:

```sql
ALTER TABLE policy_snapshots DROP COLUMN IF EXISTS health_check_json;
```
