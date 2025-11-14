# Comparison Analysis Debug Report - hello@vyork.dk
**Date:** November 14, 2025  
**User:** hello@vyork.dk (ID: e85ec3b9-e354-4c49-9f68-194830e356af)  
**Request:** Run comparison analysis for svphil offer

---

## 🔍 Executive Summary

**Status:** ❌ **CANNOT RUN COMPARISON**

**Root Cause:** Missing offer PDF file + No health checks on current policies

---

## 📋 Current State

### Documents (5 total)
| Document ID | Type | Filename | Status |
|-------------|------|----------|--------|
| f66209ca... | current | User Insurance.pdf | ✅ Has snapshots |
| **6c7e7d93...** | **offer** | **attachment_1760...pdf** | ❌ **PDF MISSING** |
| 0d67a638... | current | Offer Insurance.pdf | ✅ Has snapshots |
| 62fa8548... | current | User Insurance.pdf | ✅ Has snapshots |
| c008290f... | current | User Insurance.pdf | (status unknown) |

### Policy Snapshots (3 total)
| Snapshot ID | Company ID | Type | Document Type | Health Check |
|-------------|-----------|------|---------------|--------------|
| 2610557a... | 322935ed... | indbo | current | ❌ None |
| 20c6e2d4... | 322935ed... | ulykke | current | ❌ None |
| 4f1d13ae... | 322935ed... | hus | current | ❌ None |

**Offer Snapshots:** 0 (should have svphil policies)

### Health Checks
- **Total:** 0
- **Current with health checks:** 0/3
- **Offer with health checks:** 0/0

### Comparisons
- **Existing comparisons:** 0

---

## 🐛 Detailed Issues

### Issue #1: Missing Svphil Offer PDF ❌ CRITICAL

**Document ID:** `6c7e7d93-187f-4ae9-9ca8-bf40d60e15ce`  
**Filename:** `attachment_1760437335072_7041411_1991117.pdf`  
**Expected Path:** `uploads/attachment_1760437335072_7041411_1991117.pdf`  
**Upload Date:** October 14, 2025 (10:22:52 UTC)  
**Status in DB:** `extractionStatus: pending`

**Error Message:**
```
[Mistral OCR] Error encoding PDF: Error: ENOENT: no such file or directory, 
open 'uploads/attachment_1760437335072_7041411_1991117.pdf'
```

**Root Cause:**  
The PDF file was uploaded over a month ago but is no longer on the server. Likely causes:
- Server restart/crash cleared the uploads directory
- File cleanup job removed old pending uploads
- Upload process didn't complete properly

**Files Currently in Uploads Directory:**
```
total 2.3M
-rw-r--r-- 169K Nov 10 11:51  16c8b70b4543e19b9e028c9af2c1c5b6
-rw-r--r-- 305K Oct  9 06:05  39bef50472b465f4721a67533581cf70
-rw-r--r-- 169K Nov 10 13:50  45f72bad3da43455460e5a12c59f84e2
-rw-r--r-- 169K Nov  6 10:22  5a10332e6d0a9d0db346aaee607f6b78
-rw-r--r-- 169K Nov 10 14:23  711661e51d192aa787462a8a9cc6e9c8
-rw-r--r-- 169K Nov 11 07:50  8101584d1b9de94ab3cba56aa16c7f3b
-rw-r--r-- 169K Nov  7 08:03  a1c6486dbc6248b506c2821de3c59679
-rw-r--r-- 305K Nov  6 10:31 'attachment_1762425094395_Offer Insurance.pdf'
-rw-r--r-- 169K Nov  6 10:17  ddfb4fe01e31ece3753ee3c26269da54
-rw-r--r-- 305K Oct  9 06:00  e16f74ef8d27d2137f09ceec5b8ae76a
-rw-r--r-- 169K Nov  7 12:04  e640f07e1285b1dbd8384bca400a6645
```

**Note:** No file from October 14th exists. Oldest files are from October 9th.

---

### Issue #2: No Health Checks on Current Policies ❌ CRITICAL

**Affected Snapshots:** All 3 current policies  
**Company:** 322935ed-96dd-498f-8685-4ce204ef613c  
**Policy Types:** indbo, ulykke, hus

**Why This Blocks Comparison:**
- Phase 2 (HealthCheckAnalyst) must complete BEFORE Phase 3 (Matching) can run
- Health checks provide the structured data (`whatsIncluded`) used in comparisons
- Without health checks, the comparison agent has no data to analyze

**Possible Causes:**
1. Policies were extracted before health check pipeline was implemented
2. Health check orchestrator wasn't triggered after extraction
3. Health checks failed silently during extraction

---

### Issue #3: No Offer Policies ❌ BLOCKING

**Expected:** At least 1 svphil offer policy  
**Actual:** 0 offer policies

**Why:**
- The offer document exists in DB but extraction never completed
- PDF file missing → Extraction pipeline can't run
- No snapshots created → No health checks → No comparison

---

## 🔧 What Was Attempted

### 1. Reprocess Endpoint
**Command:**
```bash
curl -X POST http://localhost:5000/api/documents/reprocess/{userId}
```

**Result:** ❌ Found 0 documents to reprocess

**Reason:** Reprocess endpoint only processes documents with **empty OCR data**, but our offer document has `extractionStatus: pending` (started but didn't finish).

### 2. Force Extraction Script
**Script:** `server/scripts/force-extract-offer.ts`

**Result:** ❌ Failed

**Error:**
```
ENOENT: no such file or directory, open 'uploads/attachment_1760437335072_7041411_1991117.pdf'
```

**Reason:** PDF file doesn't exist on server.

### 3. Health Check Orchestration
**Endpoint:** `/api/health-checks/orchestrate` (attempted)

**Result:** ❌ Endpoint doesn't exist

**Note:** Health checks run automatically after extraction completes. There's no batch endpoint for existing snapshots.

---

## ✅ Solution: Step-by-Step Action Plan

### Step 1: Re-upload Svphil Offer PDF ⭐ REQUIRED
**Action:** User must re-upload the svphil offer document through the web UI

**Why:** Original PDF file is lost from server, cannot be recovered

**What Happens:**
1. Upload triggers extraction pipeline automatically
2. OCR extracts text from PDF
3. Segmentation splits multi-policy document
4. Extraction creates offer snapshots
5. Health checks run automatically for each snapshot

**Expected Result:** 1-3 offer policies created with health checks

---

### Step 2: Manually Trigger Health Checks for Current Policies (OPTIONAL)
**Option A: Re-upload Current Policies**
- Easiest solution: re-upload the 3 current policy PDFs
- Extraction pipeline will create fresh snapshots with health checks

**Option B: Create Manual Script to Backfill Health Checks**
- Write script to run health check orchestrator for existing snapshots
- More complex, requires development work

**Recommendation:** Option A (re-upload) is simpler and ensures data freshness

---

### Step 3: Verify Health Checks Completed
**Check:**
```bash
tsx server/scripts/debug-user-comparison.ts
```

**Expected Output:**
```
Current policies with health checks: 3
Offer policies with health checks: 1-3
Ready for comparison: ✅ YES
```

---

### Step 4: Trigger Comparison Pipeline
**Method 1: Automatic (Recommended)**
- Comparison pipeline runs automatically after health checks complete
- No manual intervention needed

**Method 2: Manual Trigger**
- Use comparison orchestrator script:
```bash
tsx server/scripts/test-comparison-pipeline.ts hello@vyork.dk
```

**Expected Result:**
- Comparison created in `company_comparisons` table
- Status: "completed"
- JSON contains policy comparisons, coverage tables, savings

---

### Step 5: View Comparison in UI
**Navigate to:**
- Offers page → Select svphil comparison
- View "Samlet" overview
- Click per-policy tabs to see detailed comparison

**Screenshot:** (Take screenshot after completion)

---

## 📊 Database Status

### Documents Table
```sql
SELECT id, document_type, file_name, extraction_status, total_policies_extracted
FROM documents
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af';
```

**Results:**
- 5 documents total
- 1 offer document (extraction stuck in "pending")
- 4 current documents

### Offer Snapshots Table
```sql
SELECT id, company_id, policy_type, document_id
FROM offer_snapshots
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af';
```

**Results:**
- 3 snapshots (all current)
- 0 snapshots from offer document

### Health Checks Table
```sql
SELECT id, snapshot_id, status
FROM health_checks
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af';
```

**Results:**
- 0 health checks

### Company Comparisons Table
```sql
SELECT id, current_company, offer_company, status
FROM company_comparisons
WHERE user_id = 'e85ec3b9-e354-4c49-9f68-194830e356af';
```

**Results:**
- 0 comparisons

---

## 🎯 Production Recommendations

### Immediate Fixes
1. **File Persistence:** Ensure uploaded PDFs are persisted to durable storage (not ephemeral uploads directory)
2. **Health Check Backfill:** Create migration script to run health checks for existing snapshots without health checks
3. **Extraction Retry:** Add automatic retry logic for stuck "pending" extractions

### Long-Term Improvements
1. **File Storage:** Use object storage (S3, GCS, Replit Object Storage) instead of local filesystem
2. **Extraction Monitoring:** Alert when extractions are stuck in "pending" for >1 hour
3. **Health Check Endpoint:** Create batch endpoint to trigger health checks for existing snapshots
4. **Data Validation:** Add cron job to detect and alert on orphaned documents (DB record exists, file missing)

---

## 📸 Screenshots

### Screenshot 1: Database State
*To be captured after viewing in UI*

### Screenshot 2: Missing File Error
```
[Mistral OCR] Error encoding PDF: Error: ENOENT: no such file or directory, 
open 'uploads/attachment_1760437335072_7041411_1991117.pdf'
```

### Screenshot 3: Uploads Directory
*Shows files from Oct 9, Nov 6-11, but NOT Oct 14*

---

## ✅ Verification Checklist

Before comparison can run:
- [ ] Svphil offer PDF re-uploaded
- [ ] Offer extraction completed (status = "completed")
- [ ] Offer snapshots created (≥1)
- [ ] Health checks completed for offer snapshots
- [ ] Health checks completed for current snapshots
- [ ] Comparison pipeline triggered
- [ ] Comparison status = "completed"
- [ ] Comparison JSON populated
- [ ] UI displays comparison correctly

---

## 📞 Next Steps

**Immediate Action Required:**
1. User must re-upload the svphil offer PDF
2. Wait for extraction + health check to complete (~2-3 minutes)
3. Verify health checks created
4. Comparison will run automatically

**For User:**
- The svphil offer document needs to be uploaded again (original file is lost)
- Current policies may also need re-upload to get health checks
- Once all documents are uploaded, comparison will work automatically

**For Developer:**
- Consider implementing file storage improvements listed above
- Add health check backfill script for production
- Monitor extraction pipeline for stuck documents

---

**Report Generated:** November 14, 2025  
**Debug Session Duration:** ~15 minutes  
**Status:** Awaiting user action (re-upload svphil offer PDF)
