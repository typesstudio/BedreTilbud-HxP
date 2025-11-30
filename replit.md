# BedreTilbud - Insurance Comparison Platform

## Overview
BedreTilbud is a Danish insurance comparison platform designed for users aged 50+. Its primary goal is to simplify insurance selection by enabling users to upload PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform emphasizes transparent comparisons, personalized recommendations, and an accessible, user-friendly experience, aiming to make insurance comparison efficient and clear for its target demographic.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform is built with a React and TypeScript frontend, focusing on mobile-first accessibility with large typography and high contrast, leveraging Shadcn/ui, Subframe, and TailwindCSS. It includes multi-step onboarding, an offers dashboard, and adaptive policy comparison. State management uses TanStack Query, and Wouter handles routing.

The backend is developed with Node.js and Express.js, providing a RESTful API. Key services include:
-   **Mistral OCR Service**: Extracts structured data from PDF policies.
-   **Policy Segmentation Service**: Splits multi-policy PDFs using `o1-mini`.
-   **OpenAI Extraction Service**: Processes policy segments with improved Danish prompts.
-   **Mistral Text Service**: Generates personalized emails and auto-responses.
-   **Comparison Service**: Provides AI-powered policy comparisons and recommendations using a hybrid AI strategy.
-   **Policy Matching Service**: Matches offer policies to existing user policies.
-   **Email Service**: Manages email inquiries and threading.
-   **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
-   **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL.
-   **Insurance Health Check Service**: Analyzes single policies for health scores.
-   **Health Check Orchestrator**: Automatically creates health checks for all offer_snapshots.

### Extraction Pipeline Architecture (REFACTORED Dec 2025)

The system now uses a **Simplified, Canonical Architecture** centered around `policy_snapshots`:

**Phase 1: OCR & Segmentation** (Always runs, fast, cheap)
1.  **OCR**: Converts PDFs to raw markdown text (Mistral OCR) → stored in `documents.extraction_stages.stage1_ocr.rawOutput`
2.  **Validation**: Ensures document quality
3.  **Policy Segmentation**: Identifies and splits multiple policies (`o1-mini`) → stored in `documents.extraction_stages.stage2_segmentation.rawOutput`
4.  **PolicySnapshot Creation**: **NEW** - Creates one `policy_snapshots` row per segment with:
    - `kind`: "current" or "offer" (from document type)
    - `companyName`, `policyType`, `coverageAddress`
    - `rawText`: The segment's markdown (single source of truth)
    - `structuredPolicy`: NULL initially
    - `pricing`: NULL initially
    - `sourceSegmentMeta`: Provenance (pageSpan, confidence, etc.)

**Phase 2: Optional Enrichment** (Async, expensive, can fail gracefully)
5.  **Structured Extraction**: Runs on `snapshot.rawText` to populate `structuredPolicy` (coverages, limits)
6.  **Pricing Extraction**: PricingAgent runs on `snapshot.rawText` to populate `pricing` ({ status, annualPremium, components })

**KEY ARCHITECTURAL CHANGE**: PolicySnapshots are the **CANONICAL** representation of all policies. The old flow (OfferSnapshots → HealthCheck → Comparison) is being deprecated in favor of:
- **PolicySnapshots** (core data) → **HealthCheck** (view) + **Comparison** (view)
- Both "current" and "offer" policies use the same table/schema
- System works even when `structuredPolicy` or `pricing` are NULL
- Enables robust comparison using raw text as fallback

A **Two-Phase Health Check Architecture** ensures deterministic deductible display in the UI:
-   **Phase 1: PolicyExtractor**: Extracts OCR markdown to structured policy JSON, preserving exact deductible strings.
-   **Phase 1b: PricingAgent**: A dedicated AI agent (`gpt-4o`) extracts and normalizes pricing information with Zod schema validation, confidence scoring (0-100), and status tracking ("ok", "unknown", "package_only", "conflict"). The agent handles Danish insurance pricing edge cases (intro prices, binding periods, package vs per-policy pricing) and rejects invalid responses (never returns 0 as premium). Results are attached to `structuredPolicy.pricing` with comprehensive telemetry for observability.
-   **Phase 2: HealthCheckAnalyst**: Maps coverages 1:1, populating mandatory deductibles, and assigns UI variants.
This architecture provides deterministic mapping, reprocessability, and cost-efficiency, enabled by `ENABLE_TWO_PHASE_HEALTHCHECK=true`. The Health Check Orchestrator includes **Zero-Mismatch Validation** to prevent corrupt data, ensuring `snapshot.policyType` drives policy type assignment in health checks.

An **Extraction Stages Debugging System** persists intermediate outputs (OCR, Segmentation, Extraction) to `documents.extraction_stages` for quality monitoring and debugging.

### Health Check Caching Architecture (Ticket A - Nov 2025)

The `policy_snapshots.health_check_json` JSONB column enables pre-computed health check caching:
-   **Webhook Endpoints**: `/api/webhooks/health-check` and `/api/webhooks/comparison` allow external flows (n8n, AI agents) to persist pre-computed JSON
-   **Security**: Requires `X-Webhook-Secret` header with `WEBHOOK_SECRET` env var; rate-limited to 100/min
-   **Validation**: Zod schema validation on all payloads before persisting
-   **Development**: Set `ALLOW_INSECURE_WEBHOOKS=true` to bypass auth for local testing only
-   **Types**: `HealthCheckJson` and `ComparisonJson` types in `shared/types/healthCheck.ts`
-   **Documentation**: See `docs/ticket-a-db-pipeline.md` for integration details

### Read-Only V2 API Endpoints (Ticket B - Nov 2025)

Fast, read-only endpoints that serve cached JSON without AI computation:

**Health Check Endpoints:**
-   `GET /api/v2/health-check/user/:userId/overview` - Returns all policy summaries for a user (requires auth, user-scoped)
-   `GET /api/v2/health-check/policy/:policyId` - Returns full `healthCheckJson` for a policy (404 if not cached)

**Comparison Endpoints:**
-   `GET /api/v2/comparisons/:comparisonId/overview` - Returns aggregated comparison summary from `comparisonJSON`
-   `GET /api/v2/comparisons/:comparisonId/detail` - Returns full `comparisonJSON` (404 if not cached)

**Design Principles:**
-   **No AI calls** - Pure database reads for sub-500ms response times
-   **Auth required** - All endpoints require session auth via `x-user-id` header
-   **404 for missing cache** - Returns Danish error messages when cached JSON not yet populated
-   **DTOs in `shared/apiTypes.ts`** - Clean response types with Danish policy labels

### Comparison Pipeline Architecture
This pipeline generates comprehensive comparison analyses:
1.  **Phase 3: Deterministic Policy Matching**: Pairs current and offer policies using scoring heuristics, with fallback logic for single-policy-per-type pairs. The matcher implements **Snapshot Quality Scoring** to select the best offer snapshots: +1000 points for snapshots with pricing data (`pricingStatus ≠ 'missing'`), +100 points for health check presence. This ensures PricingAgent-backed snapshots are prioritized over legacy snapshots without pricing data.
2.  **Phase 4: ComparisonAgent**: An AI-powered agent (`gpt-4o` with `gpt-4o-mini` fallback) generates validated ComparisonResult JSON using matched pairs and health check data, focusing on 1:1 coverage mapping and deductible preservation.
3.  **Phase 5: Email Notification**: After comparison completion, sends email notification to user via Resend with a magic link to view the comparison.

An **Anti-Hallucination System** constructs the policy structure in code before AI calls, preventing the AI from generating non-existent policy types. **Retry Logic** automatically retries with reinforced prompts if the AI omits required policy types. The **ComparisonOrchestrator** manages this pipeline, groups policies, and stores results in `company_comparisons`, with idempotency checks enabled by `ENABLE_COMPARISON=true`.

### Email Notification System (Nov 2025)

The platform includes an email notification system that alerts users when new insurance offer comparisons are ready:

**Architecture:**
-   **MagicLinkService** (`server/services/magicLinkService.ts`): Creates 64-character secure tokens with 14-day expiry, allowing multiple uses until expiration (to handle email scanner pre-fetches).
-   **NotificationService** (`server/services/notificationService.ts`): Orchestrates email sending with explicit idempotency checks via `company_comparisons.notified_at` column.
-   **Resend Integration**: Professional HTML emails with Danish content, sent via Replit's Resend connector.

**Database Tables:**
-   `magic_links`: Stores tokens linking to users and comparisons, with expiry tracking.
-   `notifications`: Logs all email send attempts with status ('pending', 'sent', 'failed') for debugging.
-   `company_comparisons.notified_at`: Timestamp for idempotency - prevents duplicate notifications.

**Magic Link Flow:**
1.  Comparison completes → `NotificationService.sendComparisonReady()` called
2.  Idempotency check: skip if `notified_at` already set
3.  Create magic link with `redirectPath = /sammenligning/:comparisonId`
4.  Send email via Resend with magic link URL
5.  User clicks link → `GET /magic/:token` validates token, sets `localStorage.userId`, redirects to comparison page

**Security Notes:**
-   Tokens are cryptographically random (64 hex chars from 32 random bytes)
-   Token reuse allowed until expiry (mitigates email scanner issues)
-   MVP uses localStorage for auth (should be upgraded to httpOnly cookies in production)

**Debug Report Integration:**
-   **Phase 6 – Email Notifications** in `comparisonDebugReportService.ts` shows:
    - `notified_at` timestamp from `company_comparisons`
    - Notifications table: ID, type, status, created/sent dates, errors
    - Magic Links table: token prefix, redirect path, expiry, consumption status
    - Email Delivery Summary: counts of sent/failed emails and magic link usage

The platform implements an **Enrichment Pattern** to guarantee the preservation of deterministic data (coverage rows, highlights, cost summaries) by ensuring the AI only generates narratives. This involves caching deterministic data, sending minimal input to the AI, merging AI narratives with cached data, and strict validation. For single-policy comparisons, a pure code-based deterministic builder is used, bypassing AI calls for 100% success rate and zero hallucinations in such cases.

**Pricing Coverage Metadata**: Comparison results include `meta.pricingStatus` field indicating pricing data quality: 'complete' (all policies have offer pricing), 'partial' (some policies have pricing), or 'missing' (no pricing data). This metadata is surfaced in Phase 4 debug reports for operational visibility. All cost calculations exclusively use `structuredPolicy.pricing.annualPremium` from PricingAgent, treating missing premiums as `null` to ensure accurate savings calculations.

### AI Model Configuration
A centralized configuration (`server/config/aiModels.ts`) manages AI models and enables easy switching and cost tracking. Supported models include `gpt-4o-mini`, `gpt-4o`, `gpt-4o-reasoning` (`o1-mini`), `mistral-large-latest`, and `mistral-ocr-latest`. Different configurations (Premium, Balanced, Budget) are available for varying quality and cost.

File uploads are handled by Multer (PDFs up to 10MB). The database uses Drizzle ORM with PostgreSQL. Security includes input validation, RBAC, rate limiting, and PII-redacting logging. Reliability features include AI retry logic, distributed locking, and Zod for structured validation. Null-safe pricing logic has been implemented throughout the backend to ensure accurate savings calculations, treating missing premiums as `null` rather than `0`. Enhanced pricing extraction prompts have been added to improve AI accuracy for `annualPremium` extraction.

## External Dependencies
-   **Google APIs client library**: For Gmail integration.
-   **Mistral AI**: Document OCR API (`mistral-ocr-latest`) and Chat API (`mistral-large-latest`).
-   **OpenAI API**: `o1-mini`, `gpt-4o`, `gpt-4o-mini`.
-   **Resend Email Service**: For professional email delivery.
-   **Neon Serverless PostgreSQL**: Database hosting.
-   **Drizzle ORM**: Database interactions.
-   **Multer**: File uploads.
-   **Connect-pg-simple**: PostgreSQL-backed session management.
-   **Third-Party UI Libraries**: react-dropzone, react-hook-form with Zod, date-fns.

## Developer Scripts
-   **`server/scripts/backfillPolicySnapshots.ts`**: **NEW** - Backfills `policy_snapshots` table from existing documents with `extraction_stages` data. Usage: `npx tsx server/scripts/backfillPolicySnapshots.ts` or `npx tsx server/scripts/backfillPolicySnapshots.ts --document-id=<id>`.
-   **`server/scripts/backfillPricing.ts`**: Backfills pricing data for existing snapshots using PricingAgent (supports `--force` flag).
-   **`server/scripts/regenerate-debug-reports.ts`**: Regenerates debug reports for specific comparisons to reflect updated pricing data.
-   **`server/scripts/resetTestUser.ts`**: Safely deletes all insurance-related data for a test user (defaults to `hello@vyork.dk`) while preserving the user account. Usage: `npx tsx server/scripts/resetTestUser.ts [email]`.