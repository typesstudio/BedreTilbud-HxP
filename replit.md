# BedreTilbud - Insurance Comparison Platform

## Overview

BedreTilbud is a Danish insurance comparison platform designed to help users find better insurance deals. The application allows users to upload their current insurance policies (PDFs), answer a few simple questions, and receive comparative offers from multiple insurance companies. The platform uses AI-powered OCR to extract policy information and provides intelligent recommendations based on coverage, pricing, and user preferences.

**Target Audience:** 50+ age group, requiring large typography, high contrast, and minimal cognitive load.

**Core User Flow:**
1. Upload current insurance PDFs
2. Answer basic questions about insurance needs
3. System sends inquiries to insurance companies via email
4. Receive and compare offers side-by-side
5. Get AI-powered recommendations

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React with TypeScript, using Vite as the build tool and bundler.

**UI Component Libraries:**
- **Shadcn/ui** (New York style variant) with Radix UI primitives for accessible components - primary UI library for existing components
- **Subframe** - Design component library initialized for advanced UI components (available at `@/ui/*`)
  - Installed with auth token and project ID: 34bd735365b5
  - Components synced to `src/ui/` directory
  - Tailwind integration configured
  - Note: Subframe components should not be manually modified (use `// @subframe/sync-disable` comment if necessary)

**Design System:**
- TailwindCSS for styling with CSS variables for theming
- Font families: Inter, Inter Tight, Montserrat, and Roboto
- Custom color palette optimized for accessibility (high contrast)
- Mobile-first responsive design approach

**State Management:** TanStack Query (React Query) for server state management with custom query client configuration. No global client state management library - relies on React hooks and local state.

**Routing:** Wouter for lightweight client-side routing

**Key Pages:**
- Home/Landing page
- Onboarding flow (multi-step with file upload and questionnaire)
- Offers overview (dashboard with categorized view: Modtagne tilbud, Afventer svar)
  - Modtagne tilbud: Shows comparisons with savings and AI recommendations
  - Afventer svar: Shows pending inquiries sent to companies
- Upload offer page (manual offer upload with company selection)
- Comparison view (side-by-side policy comparison)
- Email correspondence view (thread-based email history)

**Design Principles:**
- Large, readable typography for 50+ users
- Minimal cognitive load with clear CTAs
- Progress indicators for multi-step processes
- Status badges for tracking email/offer status
- Card-based layouts for content organization

### Backend Architecture

**Runtime:** Node.js with Express.js framework

**API Pattern:** RESTful API with JSON payloads

**Development Server:** Vite middleware mode for HMR during development, with custom logging

**Core Services (Adapter Pattern):**

1. **Mistral OCR Service** (`mistralOcrService.ts`): Uses Mistral AI's Document OCR API for direct PDF processing and data structuring. Returns normalized JSON with company name, policy type, premiums, deductibles, coverages, and benefits.
   - **OCR Model**: `mistral-ocr-latest` - Extracts text and structure from PDFs directly (no pdf-parse needed)
   - **Chat Model**: `mistral-large-latest` - Structures extracted markdown into JSON format
   - Base64 PDF encoding for secure API transmission
   - Extracts and flattens multi-policy documents into single normalized structure
   - Sums premiums, combines coverages, and merges benefits from multiple policies
   - Preserves document hierarchy and formatting during extraction
   - Average processing time: ~24 seconds for 18-page documents

2. **Comparison Service** (`comparisonService.ts`): AI-powered comparison engine that analyzes current vs. offer policies. Provides:
   - Savings calculations
   - Verdict (recommended/consider/not_recommended)
   - Pros/cons analysis
   - Coverage comparison with status indicators
   - Quality scoring

3. **Email Service** (`emailService.ts`): Handles email operations including:
   - Sending insurance inquiries with PDF attachments
   - Gmail API integration for inbox monitoring
   - Email thread management
   - Attachment handling
   - **Auto-polling**: Checks inbox every 2 minutes via setInterval
   - **Performance optimizations**: 
     - 24-hour email window (reduced from 7 days)
     - Max 20 emails per check
     - Database indexes for fast lookups
   - **Email body extraction**: Supports multipart/alternative format (Gmail payload.parts[])
   - **Thread matching**: Token-based (primary) → Gmail threadId (fallback)
   - **Duplicate prevention**: Tracks Gmail messageId to prevent reprocessing

4. **AI Response Service** (`aiResponseService.ts`): Intelligent email auto-response system using OpenAI GPT-4:
   - **Auto-responds** to text-only company replies (no attachments)
   - Uses conversation context and user preferences for personalized responses
   - **System prompt** stored in `ai-prompts/email-auto-response.md` for easy editing
   - Sends responses via Resend for professional delivery
   - Flags complex scenarios for human review (pricing questions, policy changes)
   - User-controlled via `aiAutoResponseEnabled` flag (default: enabled)
   - Handles common follow-ups: additional info requests, clarifications, confirmations

5. **Storage Adapter** (`storage.ts`): Interface-based storage abstraction with DatabaseStorage implementation using Drizzle ORM:
   - PostgreSQL persistence via Neon Serverless
   - User management
   - Company directory
   - Document management
   - Email thread tracking
   - Comparison results

**File Upload:** Multer middleware for handling PDF uploads with:
- 10MB file size limit
- PDF-only validation
- Local filesystem storage in `/uploads` directory

**Data Flow:**
1. User uploads PDFs → Multer stores files → Mistral OCR extraction
2. User completes questionnaire → Creates user profile
3. System sends emails to companies via Resend → Tracks threads with tokens
4. Auto-polling checks Gmail inbox every 2 minutes
5. Incoming text responses → AI auto-response sent via Resend (if enabled)
6. Incoming PDFs → Mistral OCR processing → Comparison generation
7. Results displayed in UI → User makes decision

### Database Schema

**ORM:** Drizzle ORM with PostgreSQL dialect

**Tables:**

1. **users** - User profiles and preferences
   - Personal info (email, name, age)
   - Housing type, car ownership
   - Deductible preferences
   - Additional requirements
   - AI auto-response setting (`aiAutoResponseEnabled`)

2. **companies** - Insurance company directory
   - Company name and contact email
   - Active status flag
   - Description

3. **documents** - Uploaded and received insurance documents
   - File metadata (name, path, size)
   - OCR extracted data (JSON)
   - Document type (current/offer)
   - User and company associations

4. **emailThreads** - Email conversation tracking
   - Gmail thread ID integration
   - Subject and status
   - User and company associations

5. **emails** - Individual email messages
   - Thread association
   - Direction (inbound/outbound/auto)
   - Content and attachments
   - Gmail message ID

6. **comparisons** - AI-generated policy comparisons
   - Links to current and offer documents
   - Comparison results (JSON)
   - Verdict and recommendations

**Schema Design Principles:**
- UUID primary keys for all tables
- JSON columns for flexible OCR and comparison data
- Referential integrity with foreign keys
- Timestamps for audit trails

**Performance Indexes:**
- `idx_emails_message_id`: Fast duplicate detection for Gmail messages
- `idx_email_threads_token`: Quick token-based thread lookup for incoming emails
- `idx_email_threads_gmail_id`: Gmail threadId fallback matching

### External Dependencies

**Gmail Integration:**
- Google APIs client library for Gmail access
- OAuth2 authentication via Replit Connectors
- Connected email: hej@bedretilbud.com
- Dynamic token refresh mechanism
- Read inbox capabilities for incoming offers
- Send email with attachments

**Mistral AI:**
- Document OCR API with `mistral-ocr-latest` model for PDF text extraction
- Chat API with `mistral-large-latest` model for data structuring
- TypeScript SDK (`@mistralai/mistralai`)
- Base64 PDF document processing
- Structured JSON output format

**OpenAI API:**
- GPT-4 model for policy comparison and AI auto-responses
- Used by comparison service and AI response service
- Structured JSON output format
- Fallback API key configuration

**Resend Email Service:**
- Professional email delivery with authentication (SPF/DKIM/DMARC)
- Sends initial inquiries and AI auto-responses
- Connected email: hej@bedretilbud.com
- Prevents spam flags and improves deliverability
- Reply-to token routing for thread tracking

**Database:**
- Neon Serverless PostgreSQL (`@neondatabase/serverless`)
- Connection via DATABASE_URL environment variable
- Drizzle Kit for schema migrations

**Cloud Storage:**
- Local filesystem for MVP (uploads directory)
- Designed for future cloud storage adapter swap

**Session Management:**
- Connect-pg-simple for PostgreSQL-backed sessions
- Supports future authentication implementation

**Development Tools:**
- Replit-specific plugins for development (cartographer, dev-banner, runtime error overlay)
- TypeScript for type safety
- ESBuild for production bundling

**Third-Party UI Libraries:**
- react-dropzone for drag-and-drop file uploads
- react-hook-form with Zod validation for forms
- date-fns for date formatting
- cmdk for command palette (future feature)

**Monitoring/Logging:**
- Custom Express middleware for request/response logging
- Vite logger integration
- Console-based logging with timestamps