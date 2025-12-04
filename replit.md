# BedreTilbud - Insurance Comparison Platform

## Overview
BedreTilbud is a Danish insurance comparison platform aimed at users aged 50+. It simplifies insurance selection by allowing users to upload PDF policies, complete questionnaires, and receive AI-powered comparative offers. The platform focuses on transparent comparisons, personalized recommendations, and a user-friendly experience to streamline the insurance comparison process. The business vision is to make insurance comparison efficient and clear, tapping into a demographic often underserved by modern digital tools.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform features a React and TypeScript frontend, designed for mobile-first accessibility with large typography and high contrast, utilizing Shadcn/ui, Subframe, and TailwindCSS. It includes multi-step onboarding, an offers dashboard, and adaptive policy comparison. State management is handled by TanStack Query, and Wouter manages routing.

The backend is built with Node.js and Express.js, providing a RESTful API. Key architectural decisions and services include:
-   **Simplified, Canonical Architecture**: Centered around `policy_snapshots` for both current and offer policies, serving as the single source of truth.
    -   **OCR & Segmentation**: Mistral OCR converts PDFs to markdown, `o1-mini` segments multi-policy documents.
    -   **PolicySnapshot Creation**: Creates `policy_snapshots` rows from segmented raw text.
    -   **Optional Enrichment**: Asynchronously extracts structured data and pricing from `snapshot.rawText` using AI agents.
-   **Two-Phase Health Check Architecture**:
    -   **PolicyExtractor**: Extracts structured policy JSON from OCR markdown, preserving deductible strings.
    -   **PricingAgent**: Extracts and normalizes pricing information with Zod schema validation, confidence scoring, and status tracking, handling Danish insurance specifics.
    -   **HealthCheckAnalyst**: Maps coverages and assigns UI variants, ensuring deterministic mapping and reprocessability.
    -   **Zero-Mismatch Validation**: Prevents data corruption by ensuring `snapshot.policyType` drives health check policy type assignment.
-   **Extraction Stages Debugging System**: Persists intermediate outputs (OCR, Segmentation, Extraction) for quality monitoring.
-   **Health Check Caching Architecture**: Uses `policy_snapshots.health_check_json` for pre-computed health checks, accessible via secure webhooks and validated with Zod schemas.
-   **Read-Only V2 API Endpoints**: Provides fast, read-only access to cached health check and comparison data without AI computation, ensuring sub-500ms response times.
-   **Comparison Pipeline Architecture**:
    -   **Deterministic Policy Matching**: Pairs current and offer policies using scoring heuristics, prioritizing snapshots with pricing data.
    -   **ComparisonAgent**: AI-powered agent (`gpt-4o`) generates validated `ComparisonResult` JSON.
    -   **Anti-Hallucination System**: Constructs policy structure in code before AI calls and uses retry logic for robust AI interactions.
    -   **Batch Upload Race Condition Fix**: Ensures comparison orchestrator triggers only once after all files in a batch are processed.
    -   **Offer Versioning (Step 2.4)**: When revised offers arrive for the same (userId, companyName, policyType), previous offer snapshots and comparisons are marked as `superseded` (`isActive=false` for snapshots, `isSuperseded=true` for comparisons). UI and API only show the latest active version.
    -   **Partial Coverage Handling (Step 4.1 & 4.2)**: Graceful handling of offers with partial or extra coverage. Match status tracks three states: `matched` (policy exists in both current and offer), `missing_in_offer` (user has policy but offer doesn't cover it), `missing_in_user` (offer has policy but user doesn't have it). PolicyComparisonService uses policyType-level matching (ignoring coverage address differences) to prevent duplicate warnings when offers have different addresses than user policies. Aggregated savings only count matched policies where both current and offer premiums are valid finite numbers > 0. Frontend shows warning banner when `coversAllCurrentPolicies` is false, and "Ekstra dækninger i dette tilbud" info section for extra policies. Defensive type guards prevent invalid data from affecting totals.
    -   **Savings Direction Classification (Step 4.4)**: Honest handling of offers that aren't cheaper. `computeSavings` helper classifies offers into three states: `cheaper` (positive savings), `same_price` (zero savings), `more_expensive` (negative savings). UI shows direction-based badges: green "Billigere" for cheaper, red "Dyrere" for more expensive, neutral "Samme pris" for equal pricing. Aggregated savings card messaging adapts to direction with honest copy. Per-policy rows and summary cards both derive styling from `savingsDirection` field.
-   **Email Notification System**: Alerts users when comparisons are ready using `MagicLinkService` for secure, expiring links and `NotificationService` for email orchestration via Resend.
-   **Simplified Initial Email Generation**: First inquiry emails to insurance companies now use a clean, data-driven approach:
    -   Extracts unique policy types from uploaded OCR documents (e.g., "Bilforsikring", "Indboforsikring")
    -   Uses simplified template: company name, user name, and list of requested insurance types
    -   Removed hardcoded references to "villa", "selvrisiko 5.000 kr" etc.
    -   Clear request for PDF quote attached to reply (not MitID links)
    -   AI fallback chain: Mistral → OpenAI gpt-4o-mini → Template
-   **Enrichment Pattern**: Guarantees preservation of deterministic data by merging AI narratives with cached information.
-   **AI Model Configuration**: Centralized management for AI models (`gpt-4o-mini`, `gpt-4o`, `mistral-large-latest`, `mistral-ocr-latest`) with configurable quality and cost settings.
-   **Data Persistence**: Drizzle ORM with Neon Serverless PostgreSQL.
-   **Security**: Input validation, RBAC, rate limiting, PII-redacting logging.
-   **Reliability**: AI retry logic, distributed locking, Zod for structured validation, null-safe pricing logic, and enhanced pricing extraction prompts.
-   **Extraction Status State Machine (Step 3.1)**: Documents follow strict status progression: `pending` → `processing` → `completed`/`failed`. All entry points (upload, email, reprocess) create documents with `pending` status. `ExtractionOrchestratorService` manages transitions with centralized `markDocumentStatus` helper. Failed extractions include machine-readable `errorReason` codes (ocr_timeout, pdf_password_protected, json_parse_error, etc.). Downstream orchestrators (Health Check, Comparison) only process documents with `completed` status.

## External Dependencies
-   **Google APIs client library**: For Gmail integration.
-   **Mistral AI**: Document OCR API and Chat API.
-   **OpenAI API**: For various AI models (`o1-mini`, `gpt-4o`, `gpt-4o-mini`).
-   **Resend Email Service**: For transactional email delivery.
-   **Neon Serverless PostgreSQL**: Cloud database hosting.
-   **Drizzle ORM**: Object-relational mapper for database interactions.
-   **Multer**: Middleware for handling `multipart/form-data`, primarily for file uploads.
-   **Connect-pg-simple**: PostgreSQL-backed session store.
-   **Third-Party UI Libraries**: react-dropzone, react-hook-form with Zod, date-fns.