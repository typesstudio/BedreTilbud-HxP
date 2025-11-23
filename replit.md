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

### Extraction Pipeline Architecture
The system employs a **Two-Step Pipeline** for robust extraction:
1.  **OCR**: Converts PDFs to raw markdown text (Mistral OCR).
2.  **Validation**: Ensures document quality.
3.  **Policy Segmentation**: Identifies and splits multiple policies (`o1-mini`).
4.  **Structured Extraction**: Extracts data per segment (`gpt-4o`) with pre-extracted hints.
5.  **OfferSnapshot Creation**: Persists data to the database.

A **Two-Phase Health Check Architecture** ensures deterministic deductible display in the UI:
-   **Phase 1: PolicyExtractor**: Extracts OCR markdown to structured policy JSON, preserving exact deductible strings.
-   **Phase 1b: PricingAgent**: A dedicated AI agent (`gpt-4o`) extracts and normalizes pricing information with Zod schema validation, confidence scoring (0-100), and status tracking ("ok", "unknown", "package_only", "conflict"). The agent handles Danish insurance pricing edge cases (intro prices, binding periods, package vs per-policy pricing) and rejects invalid responses (never returns 0 as premium). Results are attached to `structuredPolicy.pricing` with comprehensive telemetry for observability.
-   **Phase 2: HealthCheckAnalyst**: Maps coverages 1:1, populating mandatory deductibles, and assigns UI variants.
This architecture provides deterministic mapping, reprocessability, and cost-efficiency, enabled by `ENABLE_TWO_PHASE_HEALTHCHECK=true`. The Health Check Orchestrator includes **Zero-Mismatch Validation** to prevent corrupt data, ensuring `snapshot.policyType` drives policy type assignment in health checks.

An **Extraction Stages Debugging System** persists intermediate outputs (OCR, Segmentation, Extraction) to `documents.extraction_stages` for quality monitoring and debugging.

### Comparison Pipeline Architecture
This pipeline generates comprehensive comparison analyses:
1.  **Phase 3: Deterministic Policy Matching**: Pairs current and offer policies using scoring heuristics, with fallback logic for single-policy-per-type pairs.
2.  **Phase 4: ComparisonAgent**: An AI-powered agent (`gpt-4o` with `gpt-4o-mini` fallback) generates validated ComparisonResult JSON using matched pairs and health check data, focusing on 1:1 coverage mapping and deductible preservation.

An **Anti-Hallucination System** constructs the policy structure in code before AI calls, preventing the AI from generating non-existent policy types. **Retry Logic** automatically retries with reinforced prompts if the AI omits required policy types. The **ComparisonOrchestrator** manages this pipeline, groups policies, and stores results in `company_comparisons`, with idempotency checks enabled by `ENABLE_COMPARISON=true`.

The platform implements an **Enrichment Pattern** to guarantee the preservation of deterministic data (coverage rows, highlights, cost summaries) by ensuring the AI only generates narratives. This involves caching deterministic data, sending minimal input to the AI, merging AI narratives with cached data, and strict validation. For single-policy comparisons, a pure code-based deterministic builder is used, bypassing AI calls for 100% success rate and zero hallucinations in such cases.

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