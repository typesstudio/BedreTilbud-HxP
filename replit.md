# BedreTilbud - Insurance Comparison Platform

## Overview
BedreTilbud is a Danish insurance comparison platform simplifying insurance selection for users aged 50+. It allows users to upload PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform focuses on transparent comparisons, personalized recommendations, and a user-friendly, accessible experience. The overarching vision is to make insurance comparison efficient and clear for this demographic.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The platform features a React and TypeScript frontend, optimized for mobile-first accessibility with large typography and high contrast, utilizing Shadcn/ui, Subframe, and TailwindCSS. It includes multi-step onboarding, an offers dashboard, and adaptive policy comparison. State management is handled by TanStack Query, and Wouter manages routing.

The backend is built with Node.js and Express.js, providing a RESTful API. Key services include:
- **Mistral OCR Service**: Extracts structured data from PDF policies.
- **Policy Segmentation Service**: Splits multi-policy PDFs into separate blocks using `o1-mini`.
- **OpenAI Extraction Service**: Processes policy segments with improved Danish prompts.
- **Mistral Text Service**: Generates personalized emails and auto-responses.
- **Comparison Service**: Provides AI-powered policy comparisons and recommendations using a hybrid AI strategy.
- **Policy Matching Service**: Matches offer policies to user's existing policies by type.
- **Email Service**: Manages email inquiries and threading with inbox monitoring.
- **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
- **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL.
- **Insurance Health Check Service**: Analyzes single policies for health scores and recommendations.
- **Health Check Orchestrator**: Automatically creates health checks for all offer_snapshots in a document upon upload or email offer processing.

### Extraction Pipeline Architecture
The system uses a **Two-Step Pipeline** for robust extraction:
1.  **OCR**: Converts PDFs to raw markdown text (Mistral OCR).
2.  **Validation**: Ensures document quality.
3.  **Policy Segmentation**: Identifies and splits multiple policies (`o1-mini`).
4.  **Structured Extraction**: Extracts data per segment (`gpt-4o`) with pre-extracted hints.
5.  **OfferSnapshot Creation**: Persists data to the database.

A **Legacy Pipeline** (`v2.0.0`) exists for single-pass extraction. The two-step pipeline improves quality by separating policy identification from data extraction, using a reasoning model for segmentation, and processing segments individually.

### Two-Phase Health Check Architecture
This architecture ensures deterministic deductible display in the UI.
-   **Phase 1: PolicyExtractor**: Pure extraction of OCR markdown to structured policy JSON, preserving exact deductible strings. Stores output in `offer_snapshots.structuredPolicy`.
-   **Phase 2: HealthCheckAnalyst**: Maps coverages 1:1, populating mandatory deductibles. Assigns UI variants based on deductible values.
This design provides deterministic mapping, reprocessability, testability, and cost-efficiency. It's enabled by `ENABLE_TWO_PHASE_HEALTHCHECK=true`.

### Extraction Stages Debugging System
This system persists intermediate outputs of the extraction pipeline (OCR, Segmentation, Extraction) to `documents.extraction_stages` for quality monitoring. Each stage captures raw output, timestamp, and metadata (tokens, cost, latency, confidence). An API endpoint `/api/documents/:id/extraction-stages` allows debugging access.

### Comparison Pipeline Architecture
This pipeline generates comprehensive comparison analyses between user's current and offer insurance policies.
1.  **Phase 3: Deterministic Policy Matching**: Pairs current and offer policies using scoring heuristics (address, person, offer number match) to ensure stable, deterministic matching.
2.  **Phase 4: ComparisonAgent**: An AI-powered agent (`gpt-4o` with `gpt-4o-mini` fallback) generates validated ComparisonResult JSON using matched pairs and health check data. It focuses on 1:1 coverage mapping and deductible preservation.
The **ComparisonOrchestrator** manages this pipeline, groups policies by company pair, and stores results in the `company_comparisons` table. It includes idempotency checks and is enabled by `ENABLE_COMPARISON=true`.

### AI Model Configuration
A centralized configuration system (`server/config/aiModels.ts`) manages AI models, enabling easy switching and cost tracking.
-   **Supported Models**: `gpt-4o-mini`, `gpt-4o`, `gpt-4o-reasoning` (`o1-mini`), `mistral-large-latest`, `mistral-ocr-latest`.
-   **Pipeline Steps**: OCR uses `mistral-ocr-latest`, Policy Segmentation uses `o1-mini` (with fallbacks), Structured Extraction uses `gpt-4o` (with fallbacks), and Health Check uses `gpt-4o-mini`.
-   **Cost/Quality Tradeoffs**: Different configurations (Premium, Balanced, Budget) offer varying levels of quality and cost per document. The "Premium" configuration (o1-mini + gpt-4o) is recommended for production.

File uploads are handled by Multer (PDFs up to 10MB). The database uses Drizzle ORM with PostgreSQL. Security measures include input validation, RBAC, rate limiting, and PII-redacting logging. Reliability features include AI retry logic, distributed locking, and Zod for structured validation.

## External Dependencies
-   **Gmail Integration**: Google APIs client library.
-   **Mistral AI**: Document OCR API (`mistral-ocr-latest`) and Chat API (`mistral-large-latest`).
-   **OpenAI API**: `o1-mini`, `gpt-4o`, `gpt-4o-mini`.
-   **Resend Email Service**: For professional email delivery.
-   **Neon Serverless PostgreSQL**: Database hosting.
-   **Drizzle ORM**: Database interactions.
-   **Multer**: File uploads.
-   **Connect-pg-simple**: PostgreSQL-backed session management.
-   **Third-Party UI Libraries**: react-dropzone, react-hook-form with Zod, date-fns.