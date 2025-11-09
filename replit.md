# BedreTilbud - Insurance Comparison Platform

## Overview

BedreTilbud is a Danish insurance comparison platform aimed at users aged 50+. Its primary purpose is to simplify insurance selection by allowing users to upload existing PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform provides clear comparisons, personalized recommendations, and a user-friendly experience with a focus on accessibility through large typography and high contrast. The ambition is to streamline the insurance comparison process, making it transparent and efficient for an underserved demographic.

## Recent Changes (November 2025)

### Health Check Debugging & 120-Month Chart Generation (Complete - Nov 9, 2025)
Fixed health check analysis to consistently generate complete cumulative savings projections with 120 monthly data points:

**Root Cause Identified**:
- AI prompt was complete but OpenAI consistently generated only 12 chart data points instead of required 120
- Missing selvrisiko formatting in health check output (showed "inkluderet" instead of "2.834 kr")
- No validation or normalization of AI output before persisting to database

**Deterministic Chart Generation**:
- Implemented `generate120MonthChartData()` to create exactly 120 monthly data points from realistic annual savings
- Added `normalizeCumulativeSavings()` to validate AI output and fill missing chartData deterministically
- Backend now guarantees 120-point chart regardless of AI output quality (fail-safe design)

**Enhanced AI Prompt**:
- Updated `health-check/analysis.md` with explicit selvrisiko extraction rules
- Added Danish thousand-separator formatting instructions (2834 → "2.834 kr")
- Added complete cumulativeSavings JSON schema with all required fields

**Debug Tooling**:
- Created `GET /api/debug/ocr/:documentId` endpoint to inspect raw Mistral OCR markdown and parsed policies
- Endpoint has proper authentication (requireAuth) and ownership validation
- Created `regenerate-health-check.ts` script for testing health check analysis on existing policies

**Test Results**:
- ✅ Chart Data Points: 120 (was 12 before)
- ✅ Potential Savings: Conservative 1.048 kr, Realistic 1.747 kr, Optimistic 2.514 kr/year
- ✅ Cumulative Savings: 17.470 kr over 10 years
- ✅ Selvrisiko Display: "2.834 kr" shown correctly in all coverage items
- Architect-reviewed: Production-ready, meets determinism and security objectives

**Files Modified**:
- `server/services/insuranceCheckService.ts`: Added chart generation and normalization functions
- `server/ai-prompts/health-check/analysis.md`: Enhanced selvrisiko extraction rules
- `server/routes.ts`: Added debug OCR endpoint with authentication
- `server/scripts/regenerate-health-check.ts`: Testing utility for health check regeneration

### Policy Similarity Detection & Comparison Validation (Complete - Nov 9, 2025)
Implemented comprehensive solution to prevent comparing identical policies and ensure high-quality comparison outputs:

**Policy Similarity Detection**:
- Added smart validation in `PolicyMatchingService.arePoliciesSimilar()` that only flags policies as identical when sufficient data exists
- Requires at least 2 non-null fields to match before flagging as similar (prevents false positives with incomplete OCR)
- Checks: policy number (exact match), premium (1% tolerance), deductible (<10 kr), company (fuzzy match including variations)
- Throws `IDENTICAL_POLICIES:` error when detected, creating structured response for frontend

**Comparison Output Validation**:
- Added `ComparisonService.validateComparisonCompleteness()` to check AI output quality
- Validates minimum requirements: 3+ detailedComparison categories, 3+ highlights, pros/cons arrays
- Logs warnings for incomplete data but doesn't block operation (fail-safe design)

**Enhanced OCR Validation**:
- Expanded `convertToPolicyRecord()` validation to check premium, company, coverages
- Improved logging with detailed extraction data and confidence scores for debugging

**User-Facing Error Messages**:
- Backend catches `IDENTICAL_POLICIES` errors and returns structured response with custom message
- Frontend displays appropriate toast messages: "Identisk police opdaget" for identical policies, success for comparisons
- Handles 3 scenarios: identical policies only, successful comparisons, generic upload

**Comparison Prompt Enhancement**:
- Updated `policy-comparison.md` with explicit requirements for comprehensive detailedComparison sections
- Mandates minimum 3 categories: "Pris og gebyrer" (4+ rows), "Dækning" (5+ rows), "Tillægsdækninger"
- Prevents empty or incomplete comparison outputs

**Testing**: All 8 automated test cases pass, validating correct behavior for identical policies, different policies, missing data, and edge cases

**Files Modified**:
- `server/services/policyMatchingService.ts`: Added similarity detection logic
- `server/services/comparisonService.ts`: Added validation method
- `server/utils/policyExtractionParser.ts`: Enhanced OCR validation
- `server/routes.ts`: Added error handling for identical policies
- `client/src/pages/upload-offer.tsx`: Added user-facing messages
- `server/ai-prompts/comparison/policy-comparison.md`: Enhanced requirements

### OCR Danish Number Format Improvements (Complete - Nov 9, 2025)
Fixed critical OCR extraction issues for Danish insurance PDFs with comprehensive preprocessing and parsing improvements:

**Key Improvements**:
- **Danish Number Parsing**: Added explicit normalization rules to handle Danish number format (period as thousands separator, comma as decimal)
  - Parser removes ALL separators (dots, spaces, apostrophes), then replaces comma with period before parsing
  - Examples: "5.682,13 kr" → 5682.13, "3.154,04 kr" → 3154.04, "31 260 kr" → 31260
- **Dotted Leader Preprocessing**: Fixed pricing patterns split by line breaks in OCR markdown
  - Merges patterns like "Din pris pr. år ................ <br> 3.154,04 kr" → "Din pris pr. år: 3.154,04 kr"
  - Conservative regex (\.{3,}) only matches actual dotted leaders to prevent false matches
  - Handles three Danish pricing patterns: "Din pris pr. år", "Månedlig pris er", "Årlig pris inklusiv"

**Files Modified**:
- `server/ai-prompts/ocr/policy-extraction.md`: Added Danish number format parsing instructions with examples
- `server/services/mistralOcrService.ts`: Implemented OCR markdown preprocessing before AI structured extraction

**Testing & Debugging Tools**:
- `server/scripts/debug-ocr-markdown.ts`: Created debug script for investigating raw OCR markdown output
- `server/scripts/reprocess-svphil.ts`: End-to-end validation script for multi-policy extraction

**Test Results**:
- ✅ Fritidshusforsikring (hus): 5623.47 kr extracted correctly
- ✅ Ulykkesforsikring (ulykke): 995.10 kr extracted correctly
- Architect-reviewed: Production-ready, no regressions

### Multi-Policy Comparison Feature (Complete - Nov 8, 2025)
Implemented automatic 1:1 policy matching and tabbed comparison interface for offers with multiple policies:

**Backend (Complete)**:
- Extended comparisons schema with `policyType`, `currentPolicyId`, `offerPolicyId` fields and indexes
- Created `PolicyMatchingService` for automatic 1:1 matching (offer policy → current policy by type)
- Implemented combined overview service aggregating savings/highlights across all policy types
- Added API endpoints with requireOwnership authorization:
  - `GET /api/sammenligning/:userId/:companyId` - Get all comparisons for a company
  - `GET /api/sammenligning/:userId/:companyId/combined` - Get aggregated overview
- Fixed PostgreSQL numeric type handling (premium fields converted to numbers)

**Frontend (Complete)**:
- Created `OfferComparisonPage.tsx` at `/sammenligning/:userId/:companyId`
- Implemented tabbed interface with "Samlet" (combined) tab + individual policy type tabs
- Combined tab shows total savings, quick comparison table, aggregated highlights
- Individual tabs display detailed policy-specific comparisons with savings, highlights, detailed tables
- Updated offers-overview page to link to new multi-policy comparison page
- Production-ready with proper error handling and loading states

**Architecture Notes**:
- When company sends multi-policy offer, backend automatically matches each offer policy to user's current policy by type
- Unmatched offer policies (where user has no current policy of that type) trigger health checks
- Map deletion in matching logic ensures strict 1:1 matching (no policy reuse)
- Architect-reviewed: production-ready, no security issues

### Landing Page Wizard (In Progress)
Implementing a new 3-step wizard as the primary landing page:
1. **Step 1**: Email collection with simplified authentication (no magic link initially)
2. **Step 2**: PDF upload with drag-and-drop (10MB limit, optional skip)
3. **Step 3**: Company selection (4 popular + 4 others), CPR input (XXXXXX-XXXX format), priority selection

**Backend Complete (Nov 6, 2025)**:
- Added `logoUrl` and `popular` fields to companies table
- Added `insurancePriority` field to users table
- Created `onboarding_progress` table for wizard state persistence
- Implemented onboarding progress API endpoints (GET/POST/PUT)
- Pre-seeded 8 Danish insurance companies with Cloudinary logo URLs
- Fixed all LSP errors in storage layer

**Frontend To-Do**:
- Sync Subframe components (ID: 34bd735365b5)
- Build 3-step wizard components
- Implement CPR validation and auto-formatting
- Integrate with onboarding progress API
- Add background OCR processing on offers page
- See `LANDING_PAGE_IMPLEMENTATION_GUIDE.md` for complete specification

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform features a React and TypeScript frontend, optimized for mobile-first accessibility for users aged 50+, utilizing Shadcn/ui, Subframe, and TailwindCSS for a high-contrast, large-typography design. State management is handled by TanStack Query and routing by Wouter. Key frontend features include multi-step onboarding, an offers dashboard, manual offer upload, and an adaptive side-by-side policy comparison with an interactive "Missing Information Section."

The backend is built with Node.js and Express.js, exposing a RESTful API. It employs an adapter pattern for core services:
- **Mistral OCR Service**: Extracts and structures data from PDF policies using Mistral AI's OCR.
- **Mistral Text Service**: Generates personalized emails and auto-responses.
- **Comparison Service**: Provides AI-powered policy comparisons, savings calculations, and recommendations using a hybrid AI strategy (Mistral first, then OpenAI's `gpt-4o-mini`).
- **Policy Matching Service**: Automatically matches offer policies to user's current policies by type (1:1 matching) when companies send multi-policy offers, creating comparisons or health checks as appropriate.
- **Email Service**: Manages email inquiries, monitors a Gmail inbox for replies, extracts content, and handles threading.
- **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
- **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL, managing various entities like users, companies, comparisons, and policies.
- **Insurance Health Check Service**: Analyzes single uploaded policies to provide an overall health score, potential savings, strengths/weaknesses, market comparison, and actionable recommendations using `gpt-4o-mini`.

File uploads are handled by Multer, supporting PDF files up to 10MB. The database utilizes Drizzle ORM with PostgreSQL, employing UUID primary keys, JSON columns, and optimized indexing for performance. A hybrid AI strategy minimizes costs by prioritizing Mistral AI and falling back to OpenAI's `gpt-4o-mini` or template-based responses, with all AI operations logged for cost analysis. Comprehensive security measures include input validation, role-based access control, rate limiting, file security, network security headers, PII-redacting logging, and a global error handler. Reliability is enhanced with AI retry logic, distributed locking for email polling, and optimized connection pooling. Scalability features include pagination for data endpoints and health check endpoints.

## External Dependencies

-   **Gmail Integration**: Google APIs client library for inbox monitoring and email sending.
-   **Mistral AI**: Document OCR API (`mistral-ocr-latest`) for PDF processing and Chat API (`mistral-large-latest`) for text generation and data structuring.
-   **OpenAI API**: `gpt-4o-mini` for policy comparisons, insurance health checks, and as a fallback for text generation.
-   **Resend Email Service**: For professional email delivery.
-   **Neon Serverless PostgreSQL**: Database hosting.
-   **Drizzle ORM**: For database interactions and schema management.
-   **Multer**: For file uploads.
-   **Connect-pg-simple**: For PostgreSQL-backed session management.
-   **Third-Party UI Libraries**: react-dropzone, react-hook-form with Zod, date-fns.