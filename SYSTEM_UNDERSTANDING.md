# BedreTilbud - Complete System Understanding

## Core Purpose
BedreTilbud helps Danish users aged 50+ compare insurance offers easily. Instead of manually reading complex policy documents, users upload their current insurance PDFs, and the system automatically analyzes them and compares them against new offers from insurance companies.

## Complete User Journey

### Phase 1: User Onboarding & Current Policy Upload
1. User creates account (email-based)
2. User uploads their current insurance PDF(s) - could be 1-7 different policies (indbo, hus, ulykke, bil, rejse)
3. **Mistral OCR extracts data** from each PDF:
   - Basic info: company name, policy number, premium (annual/monthly)
   - Policy type categorization (indbo, hus, ulykke, etc.)
   - **Coverage details**: ALL the specific coverage items (Brand, Kasko, Retshjælp, Indbo limits, deductibles, etc.)
4. **AI Health Check** analyzes each policy individually - gives it a score, identifies strengths/weaknesses, suggests improvements
5. All extracted policies stored in database and displayed on "Tilbud oversigt" (offers overview page)

### Phase 2: Insurance Company Sends Offer
1. User receives email with question about their insurance needs
2. Insurance company emails back with offer PDF(s) - could be:
   - Single PDF with one policy type
   - Single PDF with multiple policy types combined
   - Multiple separate PDFs (one per policy type)
3. **Same extraction process runs**:
   - Mistral OCR extracts all data
   - Categorizes by policy type (automatically splits multi-policy PDFs)
   - Health check for each offer policy
   - Saves to database

### Phase 3: Automatic 1:1 Policy Matching & Comparison
1. **Smart matching**: System automatically pairs each offer policy with user's current policy of the same type
   - Offer "indbo" → User's current "indbo"
   - Offer "hus" → User's current "hus"
   - Offer "ulykke" → User's current "ulykke"
2. **AI Comparison** generates for each matched pair:
   - **Annual savings calculation**: (Current premium - Offer premium)
   - **Percentage savings**: Savings ÷ Current premium × 100
   - **Highlights array**: Key improvements where offer is better (e.g., "Højere dækningssum +500k")
   - **Detailed comparison table**: Row-by-row coverage comparison showing what's "inkluderet" vs "ikke inkluderet" and specific values for both policies
   - **Monthly savings**: For 10-year cumulative chart
3. All comparisons saved to database

### Phase 4: Multi-Policy Comparison View
1. User clicks on a company offer in navigation sidebar
2. See **tabbed interface**:
   - **"Samlet oversigt" tab**: Combined view showing total savings across all policy types, aggregated highlights, quick comparison table
   - **Individual policy tabs** (Indbo, Hus, Ulykke): Detailed view for each policy type showing:
     - Annual cost comparison card (savings amount + percentage)
     - Highlights cards (without icons)
     - Detailed comparison table (coverage items with inkluderet/ikke inkluderet status)
     - Cumulative savings chart (simple 10-year projection)

## Technical Architecture

### Backend Services
- **MistralOcrService**: PDF → structured policy data (with Danish number format handling)
- **ComparisonService**: Two policies → comparison analysis (savings, highlights, detailed rows)
- **PolicyMatchingService**: Automatic 1:1 matching by policy type
- **EmailService**: Gmail integration for sending inquiries and monitoring replies
- **Storage**: PostgreSQL with Drizzle ORM

### Frontend
- Mobile-first React app for 50+ demographic (large text, high contrast)
- Key pages: Offers overview, Upload, Multi-policy comparison (tabbed)
- TanStack Query for data fetching, Wouter for routing

## Data Requirements for Comparison Display

### 1. Årlig omkostning sammenligning (Annual Cost Comparison)
- Total annual savings in kr
- Percentage savings
- Current price (Nuværende) vs New price (Ny pris)

### 2. Højdepunkter (Highlights)
- Array of highlight objects with descriptions
- NO icons (per user preference)
- Examples: "Højere dækningssum +500k bygning", "Lavere selvrisiko -1000 kr pr. skade"

### 3. Detaljeret sammenligning (Detailed Comparison Table)
- Row-by-row coverage comparison
- Columns: Coverage item | Current policy | New offer
- Each cell shows: "inkluderet" (green), "ikke inkluderet" (red), or specific values (e.g., "225,000 kr")
- Coverage categories discovered dynamically from PDFs (Brand, Kasko, Hus og grundejeransvar, Retshjælp, Indbo, Invaliditet, Bygningsbrand, etc.)

### 4. Kumulativ besparelse (Cumulative Savings Over Time)
- Simple calculation: (Current premium - Offer premium) × months
- AreaChart showing 10-year projection
- Three metrics displayed:
  - Monthly savings estimate
  - Total after 12 months
  - Expected savings after 10 years

## User Preferences

### Design Requirements
- Mobile-first layout optimized for 50+ demographic
- Large typography and high contrast
- Simple, everyday language (no technical jargon)
- Green for positive/included, red for negative/excluded

### Comparison Logic Preferences (Nov 2025)
1. Allow AI to discover coverage categories dynamically from each PDF
2. Remove icons from highlights
3. If coverage data not available, show "ikke inkluderet"
4. Multi-PDF offers should automatically detect and split by policy type
5. Cumulative savings chart uses simple calculation: one line showing (current premium - offer premium) × months over 10 years

## Current Implementation Status

### Working Features
- User authentication and session management
- PDF upload (10MB limit, multiple files)
- Mistral OCR extraction with Danish number format handling
- Multi-policy PDF categorization by type
- 1:1 policy matching by type
- Navigation sidebar with expandable companies
- Tabbed comparison interface with query param navigation
- Combined overview aggregating savings across policy types

### Known Issues Requiring Fix
1. **OCR extraction too shallow**: Only captures basic policy info, not detailed coverage items needed for comparison table
2. **Schema too loose**: Unstructured JSON storage doesn't guarantee required data exists for UI rendering
3. **Comparison prompt wrong structure**: AI output doesn't match screenshot requirements (missing structured highlights, detailed rows, savings projection)
4. **Frontend can't render**: Missing data means comparison views incomplete

## Next Steps
Focus on fixing the extraction → comparison → display pipeline to deliver high-fidelity comparison views matching the design screenshots.
