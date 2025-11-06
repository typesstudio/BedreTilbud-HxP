# BedreTilbud Landing Page Wizard - Implementation Guide

## 🎯 Overview

This guide details the implementation of a 3-step wizard landing page for BedreTilbud, designed specifically for Danish users aged 50+. The wizard streamlines the insurance comparison process with simplified authentication, PDF upload, and company selection.

## 📋 Requirements Summary

### User Flow
1. **Step 1**: Email collection (simplified auth - creates user directly, no magic link initially)
2. **Step 2**: PDF upload (drag-and-drop, 10MB limit, optional skip)
3. **Step 3**: Company selection + CPR/priority input (minimum 1 company required)
4. **Completion**: Auto-send inquiries → Redirect to /offers → Background OCR processing

### Key Constraints
- ✅ Block Step 3 if user skips upload in Step 2
- ✅ Minimum 1 company selection required
- ✅ CPR validation with XXXXXX-XXXX format required
- ✅ Mobile-first design for 50+ users (large typography, high contrast)
- ✅ Run OCR in background on offers page, show "Tilbud indhentes" status

## 🏗️ Architecture

### Database Schema (Already Completed ✅)

#### Companies Table Extensions
```typescript
logoUrl: text("logo_url"),           // Cloudinary URLs for company logos
popular: boolean("popular"),          // Flag for featured companies (4 total)
```

#### Users Table Extensions
```typescript
insurancePriority: text("insurance_priority")  // User's insurance selection priority
```

#### Onboarding Progress Table (New)
```typescript
{
  id: varchar("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  userId: varchar("user_id"),  // FK to users, null until user created
  currentStep: integer("current_step").default(1),  // 1, 2, or 3
  completedSteps: integer("completed_steps").array().default([]),
  selectedCompanyIds: varchar("selected_company_ids").array().default([]),
  documentId: varchar("document_id"),  // FK to documents after upload
  name: text("name"),
  cpr: text("cpr"),
  priority: text("priority"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}
```

### API Endpoints (Already Completed ✅)

#### Onboarding Progress
- `GET /api/onboarding/progress/:email` - Retrieve progress by email
- `POST /api/onboarding/progress` - Create new progress record
- `PUT /api/onboarding/progress/:email` - Update progress

#### Existing Endpoints to Use
- `POST /api/upload` - Upload PDF (multipart/form-data)
- `GET /api/companies` - Fetch all companies with logos
- `POST /api/users` - Create user account
- `POST /api/send-inquiries` - Send emails to selected companies

### Pre-Seeded Data (Already Completed ✅)

**Popular Companies (4):**
1. Tryg Forsikring - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/tryg-logo_xzf4lx.svg`
2. Alka Forsikring - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/alka-logo_rkz9ij.svg`
3. IF Forsikring - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/if-logo_n8qwhj.svg`
4. Gjensidige - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/gjensidige-logo_pqmxla.svg`

**Other Companies (4):**
5. Codan - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/codan-logo_akjfld.svg`
6. Topdanmark - `https://res.cloudinary.com/subframe/image/upload/v1735828800/uploads/6969/topdanmark-logo_zmxnwk.svg`
7. svphil - No logo
8. Types Studio - No logo

## 🎨 Design Specifications

### Subframe Components to Sync
**ID**: `34bd735365b5`

Components needed:
- **WizardStep** - Step indicator component
- **CompanyCard** - Card for displaying insurance companies
- **FileUploadZone** - Drag-and-drop upload area
- **PrioritySelector** - Dropdown for insurance priority

### Mobile-First Design Requirements

#### Typography (50+ Users)
```css
/* Base font size */
body {
  font-size: 18px;  /* Larger than typical 16px */
  line-height: 1.6;
}

/* Headings */
h1 { font-size: 2.5rem; }  /* ~40px */
h2 { font-size: 2rem; }    /* ~32px */
h3 { font-size: 1.5rem; }  /* ~24px */

/* Inputs */
input, button {
  font-size: 1.125rem;  /* 18px */
  padding: 1rem;         /* Touch-friendly */
  min-height: 48px;      /* WCAG touch target */
}
```

#### Color Contrast (High Contrast for 50+)
```css
/* From design_guidelines.md - ensure usage */
--primary: #1e40af;        /* Dark blue */
--text: #1a1a1a;           /* Near black */
--background: #ffffff;      /* White */
--border: #d1d5db;         /* Light gray */

/* Button contrast ratio: minimum 4.5:1 */
/* Text contrast ratio: minimum 7:1 (AAA level) */
```

#### Touch Targets
- Minimum button size: 48x48px (WCAG AAA)
- Minimum spacing between interactive elements: 8px
- Large tap areas for company cards: ~120x80px minimum

## 🧩 Component Architecture

### File Structure
```
client/src/
├── pages/
│   ├── LandingWizard.tsx          (NEW - Main wizard container)
│   └── OffersPage.tsx              (UPDATE - Add OCR status)
├── components/
│   ├── wizard/
│   │   ├── Step1Email.tsx          (NEW)
│   │   ├── Step2Upload.tsx         (NEW)
│   │   ├── Step3Companies.tsx      (NEW)
│   │   └── WizardProgress.tsx      (NEW - Step indicator)
│   ├── CompanySelector.tsx         (NEW)
│   └── CPRInput.tsx                (NEW)
├── lib/
│   ├── validators.ts               (UPDATE - Add CPR validation)
│   └── wizardState.ts              (NEW - Wizard state management)
└── App.tsx                         (UPDATE - Routing)
```

### Component Specifications

#### 1. LandingWizard.tsx (Main Container)
**Purpose**: Orchestrate the 3-step wizard flow

```typescript
interface WizardState {
  currentStep: 1 | 2 | 3;
  email: string;
  documentId: string | null;
  selectedCompanyIds: string[];
  name: string;
  cpr: string;
  priority: string;
}

// Key Features:
// - Manage wizard state with React Query + onboarding progress API
// - Step validation before allowing progression
// - Auto-save progress on each step completion
// - Handle final submission (send inquiries + redirect)
```

**State Management Strategy**:
```typescript
// Use TanStack Query for server state
const { data: progress, isLoading } = useQuery({
  queryKey: ['/api/onboarding/progress', email],
  enabled: !!email
});

// Use local state for current step UI
const [currentStep, setCurrentStep] = useState(1);

// Mutation for saving progress
const updateProgress = useMutation({
  mutationFn: async (data) => 
    apiRequest(`/api/onboarding/progress/${email}`, 'PUT', data),
  onSuccess: () => queryClient.invalidateQueries(['/api/onboarding/progress'])
});
```

#### 2. Step1Email.tsx
**Purpose**: Collect user email and create account

**UI Elements**:
- Email input (validated with Zod email schema)
- "Kom i gang" (Get Started) button
- Simple heading: "Find bedre forsikring i 3 simple trin"
- Subheading: "Sammenlign priser fra Danmarks førende forsikringsselskaber"

**Validation**:
```typescript
const emailSchema = z.object({
  email: z.string().email("Indtast en gyldig e-mailadresse")
});
```

**API Flow**:
1. Validate email format
2. Check if onboarding progress exists (`GET /api/onboarding/progress/:email`)
3. If exists: Load progress, set current step
4. If new: Create progress record (`POST /api/onboarding/progress`)
5. Create user if not exists (`POST /api/users`)
6. Advance to Step 2

#### 3. Step2Upload.tsx
**Purpose**: PDF upload with optional skip

**UI Elements**:
- Drag-and-drop zone (react-dropzone)
- File size indicator (10MB limit)
- "Upload Police" button
- "Spring Over" (Skip) button
- Visual feedback: Upload progress, success state

**File Validation**:
```typescript
const fileValidation = {
  accept: { 'application/pdf': ['.pdf'] },
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 1
};
```

**API Flow**:
1. User selects/drops PDF
2. Validate file (type, size)
3. Upload to `/api/upload` (multipart/form-data)
4. Receive documentId
5. Update progress: `documentId`, add step 2 to `completedSteps`
6. Advance to Step 3

**Skip Flow**:
1. User clicks "Spring Over"
2. Update progress: mark step 2 as skipped (no documentId)
3. Set flag to block company selection in Step 3
4. Show warning in Step 3: "Upload police for at vælge forsikringsselskaber"

#### 4. Step3Companies.tsx
**Purpose**: Company selection + CPR/priority input

**UI Layout**:
```
┌─────────────────────────────────────┐
│  Populære Forsikringsselskaber      │
├─────────────┬─────────────┬─────────┤
│  [Tryg]     │  [Alka]     │  [IF]   │  ← Large cards (120x80px)
│   Logo      │   Logo      │  Logo   │
├─────────────┼─────────────┼─────────┤
│ [Gjensidige]│             │         │
│   Logo      │             │         │
└─────────────┴─────────────┴─────────┘

┌─────────────────────────────────────┐
│  Andre Forsikringsselskaber         │
├──────┬──────┬──────┬──────┬────────┤
│[Cod.]│[Top.]│[svp.]│[Type]│         │  ← Smaller cards (80x60px)
└──────┴──────┴──────┴──────┴────────┘

┌─────────────────────────────────────┐
│  Din Information                     │
├─────────────────────────────────────┤
│  Navn: [___________________]        │
│  CPR:  [XXXXXX-XXXX]               │
│  Prioritet: [Dropdown ▼]           │
└─────────────────────────────────────┘

         [Få Tilbud →]
```

**Company Card Component**:
```typescript
interface CompanyCardProps {
  company: Company;
  selected: boolean;
  onToggle: (id: string) => void;
  size: 'large' | 'small';
}

// Features:
// - Visual selection state (border highlight, checkmark)
// - Company logo display
// - Accessible click/tap area
// - Disabled state if upload was skipped
```

**CPR Input Component**:
```typescript
// Auto-format as user types: XXXXXX-XXXX
const formatCPR = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6, 10)}`;
};

// Validation
const cprSchema = z.string()
  .regex(/^\d{6}-\d{4}$/, "CPR skal være i formatet XXXXXX-XXXX")
  .refine((val) => {
    const [birthDate, seq] = val.split('-');
    return birthDate.length === 6 && seq.length === 4;
  }, "Ugyldigt CPR-nummer");
```

**Priority Dropdown Options**:
```typescript
const priorityOptions = [
  { value: 'pris', label: 'Pris (laveste omkostninger)' },
  { value: 'dakning', label: 'Dækning (bedste beskyttelse)' },
  { value: 'service', label: 'Service (kundeservice)' },
  { value: 'balance', label: 'Balance (pris og dækning)' }
];
```

**Validation Rules**:
- Minimum 1 company selected (show error if user tries to submit with 0)
- Valid CPR format (XXXXXX-XXXX)
- Name required
- Priority selected
- If upload was skipped: Block selection, show message

**API Flow (Final Submit)**:
1. Validate all fields
2. Update progress with final data
3. Create user with CPR, name, priority (`PUT /api/users/:id`)
4. Send inquiries to selected companies (`POST /api/send-inquiries`)
5. Redirect to `/offers` page

#### 5. WizardProgress.tsx
**Purpose**: Visual step indicator

```typescript
// UI: Three circles connected by lines
//     [1] ─── [2] ─── [3]
//  Email  Upload  Vælg

interface WizardProgressProps {
  currentStep: 1 | 2 | 3;
  completedSteps: number[];
}

// Styling:
// - Completed: Green circle with checkmark
// - Current: Blue circle with number
// - Upcoming: Gray circle with number
```

## 🔌 API Integration Details

### 1. Creating Onboarding Progress (Step 1)
```typescript
POST /api/onboarding/progress
{
  email: "user@example.dk",
  currentStep: 1,
  completedSteps: []
}

Response:
{
  id: "uuid",
  email: "user@example.dk",
  userId: null,
  currentStep: 1,
  completedSteps: [],
  selectedCompanyIds: [],
  ...
}
```

### 2. Uploading Document (Step 2)
```typescript
POST /api/upload
Content-Type: multipart/form-data

FormData:
- file: <PDF file>
- userId: <user-id>

Response:
{
  id: "doc-uuid",
  fileName: "policy.pdf",
  filePath: "/uploads/...",
  userId: "user-uuid",
  ...
}

// Then update progress:
PUT /api/onboarding/progress/:email
{
  documentId: "doc-uuid",
  completedSteps: [1, 2],
  currentStep: 3
}
```

### 3. Final Submission (Step 3)
```typescript
// 1. Update user with CPR/name/priority
PUT /api/users/:userId
{
  name: "Lars Jensen",
  personalIdNumber: "123456-7890",
  insurancePriority: "pris"
}

// 2. Update progress with selections
PUT /api/onboarding/progress/:email
{
  selectedCompanyIds: ["company-1", "company-2", "company-3"],
  name: "Lars Jensen",
  cpr: "123456-7890",
  priority: "pris",
  completedSteps: [1, 2, 3],
  currentStep: 3
}

// 3. Send inquiries (might need to create this endpoint)
POST /api/send-inquiries
{
  userId: "user-uuid",
  companyIds: ["company-1", "company-2", "company-3"],
  documentId: "doc-uuid" // optional if skipped
}

Response:
{
  emailsSent: 3,
  threadIds: ["thread-1", "thread-2", "thread-3"]
}
```

## 🔄 Background OCR Processing

### Offers Page Updates
When user lands on `/offers` after wizard completion:

**UI States**:
1. **Loading**: Show "Tilbud indhentes..." status for each company
2. **Processing**: OCR running in background (if PDF uploaded)
3. **Complete**: Show extracted policy data + AI comparison

**Implementation Strategy**:
```typescript
// OffersPage.tsx

const { data: comparisons, isLoading } = useQuery({
  queryKey: ['/api/comparisons', userId],
  refetchInterval: (data) => {
    // Poll every 5s if any comparison has status 'pending'
    const hasPending = data?.some(c => c.status === 'pending');
    return hasPending ? 5000 : false;
  }
});

// Display logic:
comparisons?.map(comparison => (
  <ComparisonCard
    status={comparison.status} // 'pending' | 'processing' | 'complete'
    company={comparison.company}
    offer={comparison.offer}
    savings={comparison.savings}
  />
));
```

**Backend Flow** (likely already implemented):
1. `/api/send-inquiries` creates comparison records with `status: 'pending'`
2. Background job triggers OCR on uploaded document
3. OCR extracts policy data, updates comparison `status: 'processing'`
4. AI generates recommendation, updates `status: 'complete'`
5. Frontend polls and shows updated status

## 🧪 Validation & Error Handling

### Step Validation Matrix

| Step | Validation Rule | Error Message |
|------|----------------|---------------|
| 1 | Valid email format | "Indtast en gyldig e-mailadresse" |
| 1 | Email not empty | "E-mail er påkrævet" |
| 2 | PDF file only | "Kun PDF-filer er tilladt" |
| 2 | Max 10MB | "Filen må ikke overstige 10MB" |
| 3 | Min 1 company | "Vælg mindst ét forsikringsselskab" |
| 3 | CPR format | "CPR skal være i formatet XXXXXX-XXXX" |
| 3 | Name not empty | "Navn er påkrævet" |
| 3 | Priority selected | "Vælg din prioritet" |
| 3 | Upload check | "Upload police for at fortsætte" (if skipped) |

### Error Handling Strategy
```typescript
// Use react-hook-form + Zod for client-side validation
const form = useForm({
  resolver: zodResolver(stepSchema),
  defaultValues: { ... }
});

// Use TanStack Query for API error handling
const mutation = useMutation({
  mutationFn: uploadFile,
  onError: (error) => {
    toast({
      title: "Fejl",
      description: error.message,
      variant: "destructive"
    });
  }
});

// Show errors inline with form fields
{form.formState.errors.email && (
  <p className="text-red-600 text-sm mt-1">
    {form.formState.errors.email.message}
  </p>
)}
```

## 🎨 Accessibility Considerations (50+ Users)

### Visual
- ✅ Large font sizes (minimum 18px body)
- ✅ High contrast (7:1 for text, 4.5:1 for UI)
- ✅ Clear visual hierarchy
- ✅ Avoid color as only indicator (use icons + text)

### Interactive
- ✅ Large touch targets (48x48px minimum)
- ✅ Clear focus indicators
- ✅ Keyboard navigation support
- ✅ Error messages near inputs

### Content
- ✅ Simple Danish language
- ✅ Clear instructions for each step
- ✅ Progress indication
- ✅ Confirmation messages

## 📱 Responsive Breakpoints

```css
/* Mobile-first approach */
/* Default: 320px - 640px */
.wizard-container {
  padding: 1rem;
}

/* Tablet: 640px - 1024px */
@media (min-width: 640px) {
  .wizard-container {
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
  }
}

/* Desktop: 1024px+ */
@media (min-width: 1024px) {
  .wizard-container {
    max-width: 800px;
  }
  
  .company-grid {
    grid-template-columns: repeat(4, 1fr); /* Show 4 popular in row */
  }
}
```

## 🚀 Implementation Checklist

### Pre-Implementation (✅ Completed)
- [x] Database schema updated (logoUrl, popular, insurancePriority)
- [x] Database schema pushed successfully
- [x] Onboarding progress table created
- [x] API routes created (GET/POST/PUT onboarding progress)
- [x] Storage layer implemented (MemStorage + DatabaseStorage)
- [x] Companies pre-seeded with logos
- [x] All LSP errors resolved

### Phase 1: Setup & Utilities (Tasks 1-2)
- [ ] Sync Subframe components (ID: 34bd735365b5)
- [ ] Create CPR validation utility in `lib/validators.ts`
- [ ] Add wizard state types to shared schema (if needed)

### Phase 2: Components (Tasks 3-5)
- [ ] Build `Step1Email.tsx` with email validation
- [ ] Build `Step2Upload.tsx` with PDF upload + skip
- [ ] Build `Step3Companies.tsx` with company grid + inputs
- [ ] Build `WizardProgress.tsx` step indicator
- [ ] Build `CompanySelector.tsx` reusable card component
- [ ] Build `CPRInput.tsx` with auto-formatting

### Phase 3: Integration (Tasks 6-9)
- [ ] Implement wizard state management in `LandingWizard.tsx`
- [ ] Connect to onboarding progress API
- [ ] Add step validation and progression logic
- [ ] Implement auto-save on step completion
- [ ] Build final submission flow (inquiries + redirect)

### Phase 4: Background Processing (Task 10)
- [ ] Update `OffersPage.tsx` with loading states
- [ ] Add "Tilbud indhentes" status display
- [ ] Implement polling for comparison status
- [ ] Handle OCR completion gracefully

### Phase 5: Polish (Tasks 11-13)
- [ ] Apply mobile-first responsive styles
- [ ] Add accessibility features (ARIA labels, focus management)
- [ ] Update `App.tsx` routing (make wizard root '/')
- [ ] Test full wizard flow end-to-end
- [ ] Test error states and validation
- [ ] Test skip upload scenario

### Phase 6: Review (Task 14)
- [ ] Run architect review for code quality
- [ ] Address any critical feedback
- [ ] Validate against all requirements

## 🐛 Testing Scenarios

### Happy Path
1. User enters email → Step 1 complete
2. User uploads PDF → Step 2 complete
3. User selects 2 companies → Enters CPR/name/priority → Submits
4. Inquiries sent → Redirect to /offers
5. OCR runs in background → Comparisons displayed

### Skip Upload Path
1. User enters email → Step 1 complete
2. User clicks "Spring Over" → Step 2 skipped
3. Step 3 shows: Companies disabled + warning message
4. User cannot proceed until uploading

### Error Scenarios
- Invalid email format → Show inline error
- PDF > 10MB → Show file size error
- 0 companies selected → Block submission, show error
- Invalid CPR format → Show format error
- API failure → Show toast notification, allow retry

### Edge Cases
- User refreshes mid-wizard → Progress restored from API
- User navigates back → Previous steps show saved data
- User tries to skip Step 1 → Not possible (email required)
- API timeout → Show retry button

## 📊 Performance Considerations

- Lazy load company logos (use `loading="lazy"`)
- Debounce auto-save (500ms delay)
- Optimize re-renders (use `useMemo` for company lists)
- Compress uploaded PDFs if >5MB (optional enhancement)
- Cache company list (TanStack Query default 5min)

## 🔐 Security Notes

- Sanitize all user inputs (email, name, CPR)
- Validate file types on backend (don't trust client)
- Rate limit upload endpoint (prevent abuse)
- Encrypt CPR in database (if not already)
- CSRF protection on all POST/PUT requests

## 📝 Notes for Implementation

1. **Subframe Sync**: Priority component to sync first is `CompanyCard` - critical for Step 3 UI
2. **CPR Sensitivity**: Consider adding visual indicator (lock icon) when collecting CPR
3. **Mobile Testing**: Test on real devices (iPhone SE, Samsung A-series) for 50+ UX validation
4. **Danish Translations**: All UI text must be in Danish, validate grammar with native speaker if possible
5. **Loading States**: Every API call should have loading indicator (prevent double submissions)
6. **Analytics**: Consider adding event tracking for wizard step completion rates (future enhancement)

## 🎯 Success Criteria

- [ ] User can complete wizard in < 2 minutes (excluding upload time)
- [ ] Mobile usability score > 90 (Lighthouse)
- [ ] Accessibility score > 90 (Lighthouse)
- [ ] Error messages are clear and actionable in Danish
- [ ] All validation rules enforced correctly
- [ ] Background OCR doesn't block user experience
- [ ] Wizard state persists across page refreshes
- [ ] No console errors or warnings

---

**Total Tasks**: 14
**Estimated Implementation Time**: 6-8 hours
**Priority**: High (Critical user-facing feature)
**Risk Level**: Medium (complex state management + multi-step validation)

## Ready to Begin?

All backend infrastructure is complete. Focus on:
1. Syncing Subframe components
2. Building wizard components one step at a time
3. Testing thoroughly at each step
4. Architect review before final deployment
