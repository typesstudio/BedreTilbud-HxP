# BedreTilbud - Insurance Comparison Platform

## Overview

BedreTilbud is a Danish insurance comparison platform designed for users aged 50+. Its core purpose is to simplify insurance selection by enabling users to upload PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform provides clear comparisons, personalized recommendations, and a user-friendly experience with a focus on accessibility. The vision is to make insurance comparison transparent and efficient for an underserved demographic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform uses a React and TypeScript frontend, optimized for mobile-first accessibility with large typography and high contrast, leveraging Shadcn/ui, Subframe, and TailwindCSS. It includes multi-step onboarding, an offers dashboard, and adaptive policy comparison. State management uses TanStack Query, and Wouter handles routing.

The backend is built with Node.js and Express.js, exposing a RESTful API. Key services include:
- **Mistral OCR Service**: Extracts structured data from PDF policies.
- **Policy Segmentation Service**: NEW - Splits multi-policy PDFs into separate policy blocks using `o1-mini` reasoning.
- **OpenAI Extraction Service**: Upgraded - Processes policy segments individually with improved Danish prompts.
- **Mistral Text Service**: Generates personalized emails and auto-responses.
- **Comparison Service**: Provides AI-powered policy comparisons and recommendations using a hybrid AI strategy.
- **Policy Matching Service**: Automatically matches offer policies to user's existing policies by type.
- **Email Service**: Manages email inquiries and threading with inbox monitoring.
- **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
- **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL.
- **Insurance Health Check Service**: Analyzes single policies for health scores, potential savings, and recommendations.

### Extraction Pipeline Architecture

**Two-Step Pipeline** (ENABLE_TWO_STEP_EXTRACTION=true, v2.1.0):
1. **OCR** (Mistral OCR) → Raw markdown text
2. **Validation** → Quality gates for insurance documents
3a. **Policy Segmentation** (`o1-mini`) → Identifies and splits multiple policies
3b. **Structured Extraction** (`gpt-4o`) → Per-segment data extraction with pre-extracted hints
4. **OfferSnapshot Creation** → Database persistence

**Legacy Pipeline** (default, v2.0.0):
1. **OCR** (Mistral OCR) → Raw markdown text
2. **Validation** → Quality gates
3. **Structured Extraction** (`gpt-4o-mini`) → Single-pass extraction
4. **OfferSnapshot Creation** → Database persistence

**Key Improvements in Two-Step Pipeline:**
- Separates policy identification from data extraction (mimics successful manual process)
- Reasoning model for segmentation ensures multi-policy documents are split correctly
- Pre-extracted metadata (prices, company, addresses) guides extraction
- Per-segment processing enables better quality and confidence tracking
- Fallback chains allow graceful degradation to cheaper models

File uploads handled by Multer (PDFs up to 10MB). Database uses Drizzle ORM with PostgreSQL (UUIDs, JSON columns, optimized indexing). Security: input validation, RBAC, rate limiting, PII-redacting logging. Reliability: AI retry logic, distributed locking, structured validation with Zod.

## AI Model Configuration

The platform uses a centralized model configuration system (`server/config/aiModels.ts`) that enables easy model switching and cost tracking:

**Supported Models:**
- `gpt-4o-mini`: Fast, cost-efficient ($0.15/$0.60 per M tokens) - good for simple tasks
- `gpt-4o`: High-quality ($5/$15 per M tokens) - better understanding, recommended for extraction
- `gpt-4o-reasoning` (`o1-mini`): Best quality with reasoning - recommended for segmentation
- `mistral-large-latest`: Alternative high-quality model
- `mistral-ocr-latest`: Specialized OCR model

**Pipeline Step Configuration:**
- **OCR**: `mistral-ocr-latest` (optimal for document OCR)
- **Policy Segmentation**: `o1-mini` reasoning → fallback to `gpt-4o` → `gpt-4o-mini`
- **Structured Extraction**: `gpt-4o` → fallback to `gpt-4o-mini`
- **Health Check**: `gpt-4o-mini` (sufficient for health checks)

**Cost/Quality Tradeoffs:**

| Configuration | Cost/Document | Quality | Use Case |
|---------------|---------------|---------|----------|
| Premium (o1-mini + gpt-4o) | ~$0.12 | ⭐⭐⭐⭐⭐ | Production - matches manual quality |
| Balanced (gpt-4o + gpt-4o-mini) | ~$0.07 | ⭐⭐⭐⭐ | Testing with good quality |
| Budget (gpt-4o-mini only) | ~$0.03 | ⭐⭐ | Development/testing only |

**Model Selection Guide:**
- Use **Premium** for production: Quality is critical for user trust
- Use **Balanced** for high-volume testing
- Avoid **Budget** for multi-policy documents: Segmentation quality insufficient

**Environment Configuration:**
```bash
# Enable new two-step pipeline
ENABLE_TWO_STEP_EXTRACTION=true

# Override model configuration (JSON)
AI_PIPELINE_CONFIG='{"policySegmentation":{"modelId":"gpt-4o"}}'
```

**Cost Tracking:**
All AI invocations are logged with token usage, costs, latency, and confidence scores. Check console logs for `[AI Invocation]` entries.

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

## Recent Learnings & Decisions (November 2025)

### Manual vs Automated Extraction Quality Gap

**Problem:** Legacy single-step extraction (`gpt-4o-mini`) produced lower quality results than manual ChatGPT processing.

**Root Cause Analysis:**
1. Single-pass extraction struggled with multi-policy PDFs (couldn't separate Indbo, Fritidshus, Ulykke clearly)
2. Model lacked reasoning depth for complex Danish insurance terminology
3. No pre-extracted context to guide extraction
4. Pricing data often misinterpreted due to Danish number formatting

**Solution - Two-Step Pipeline:**
1. **Step 1**: Policy Segmentation with reasoning model (`o1-mini`)
   - Identifies all policies in document
   - Extracts key metadata (prices, company, addresses)
   - Creates separate content blocks per policy
   - Confidence scoring per segment

2. **Step 2**: Structured Extraction per segment (`gpt-4o`)
   - Processes one policy at a time
   - Uses pre-extracted metadata as hints
   - Improved Danish prompts with terminology guide
   - Zod validation ensures data quality

**Results:**
- Quality matches manual ChatGPT process
- Correct policy separation for multi-policy documents
- Better handling of Danish terminology and number formats
- Higher confidence scores (avg 0.85+ vs 0.65 previously)
- Cost increase justified by quality improvement

**When to Use Each Pipeline:**
- **Two-Step**: Production use, multi-policy documents, quality-critical scenarios
- **Legacy**: Single-policy documents, development testing, cost-sensitive environments