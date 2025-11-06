# BedreTilbud - Insurance Comparison Platform

## Overview

BedreTilbud is a Danish insurance comparison platform aimed at users aged 50+. Its primary purpose is to simplify insurance selection by allowing users to upload existing PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform provides clear comparisons, personalized recommendations, and a user-friendly experience with a focus on accessibility through large typography and high contrast. The ambition is to streamline the insurance comparison process, making it transparent and efficient for an underserved demographic.

## Recent Changes (November 2025)

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
- **Email Service**: Manages email inquiries, monitors a Gmail inbox for replies, extracts content, and handles threading.
- **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
- **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL, managing various entities like users, companies, and comparisons.
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