# BedreTilbud - Insurance Comparison Platform

## Overview

BedreTilbud is a Danish insurance comparison platform designed for users aged 50+. Its core purpose is to simplify insurance selection by enabling users to upload PDF policies, complete a questionnaire, and receive AI-powered comparative offers. The platform provides clear comparisons, personalized recommendations, and a user-friendly experience with a focus on accessibility. The vision is to make insurance comparison transparent and efficient for an underserved demographic.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

The platform uses a React and TypeScript frontend, optimized for mobile-first accessibility with large typography and high contrast, leveraging Shadcn/ui, Subframe, and TailwindCSS. It includes multi-step onboarding, an offers dashboard, and adaptive policy comparison. State management uses TanStack Query, and Wouter handles routing.

The backend is built with Node.js and Express.js, exposing a RESTful API. Key services include:
- **Mistral OCR Service**: Extracts structured data from PDF policies.
- **Mistral Text Service**: Generates personalized emails and auto-responses.
- **Comparison Service**: Provides AI-powered policy comparisons and recommendations using a hybrid AI strategy (Mistral first, then OpenAI's `gpt-4o-mini`).
- **Policy Matching Service**: Automatically matches offer policies to user's existing policies by type.
- **Email Service**: Manages email inquiries and threading with inbox monitoring.
- **AI Response Service**: Automatically responds to company replies using a hybrid AI strategy.
- **Storage Adapter**: Abstracts data persistence using Drizzle ORM with Neon Serverless PostgreSQL.
- **Insurance Health Check Service**: Analyzes single policies for health scores, potential savings, and recommendations using `gpt-4o-mini`.

A 4-stage extraction pipeline (OCR, Validation, OpenAI Structured Extraction, OfferSnapshot Creation) replaces legacy OCR, featuring quality gates, Danish number normalization, and provenance tracking. File uploads are handled by Multer (PDFs up to 10MB). The database uses Drizzle ORM with PostgreSQL, employing UUIDs, JSON columns, and optimized indexing. A hybrid AI strategy minimizes costs. Security measures include input validation, role-based access control, rate limiting, and PII-redacting logging. Reliability features AI retry logic and distributed locking.

## External Dependencies

-   **Gmail Integration**: Google APIs client library.
-   **Mistral AI**: Document OCR API (`mistral-ocr-latest`) and Chat API (`mistral-large-latest`).
-   **OpenAI API**: `gpt-4o-mini`.
-   **Resend Email Service**: For professional email delivery.
-   **Neon Serverless PostgreSQL**: Database hosting.
-   **Drizzle ORM**: Database interactions.
-   **Multer**: File uploads.
-   **Connect-pg-simple**: PostgreSQL-backed session management.
-   **Third-Party UI Libraries**: react-dropzone, react-hook-form with Zod, date-fns.