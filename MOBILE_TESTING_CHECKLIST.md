# Mobile Testing Checklist - BedreTilbud

## Overview
This checklist validates mobile optimization for users aged 50+ on BedreTilbud insurance comparison platform.

## Testing Devices
- [ ] iPhone 12/13/14 (375x667 - 390x844)
- [ ] Samsung Galaxy S21/S22 (360x800 - 412x915)
- [ ] iPad (768x1024)
- [ ] Desktop breakpoints (1024px, 1280px, 1440px)

## Core Accessibility Requirements (50+ Users)
- [ ] **Touch Targets**: All buttons/links minimum 48x48px (preferably 56px height)
- [ ] **Font Sizes**: Body text 16px+, headings proportionally larger
- [ ] **Contrast**: All text passes WCAG AA (4.5:1 minimum)
- [ ] **Spacing**: Generous padding between interactive elements
- [ ] **No Horizontal Scroll**: All content fits viewport width

## Page-by-Page Validation

### 1. Home Page (`/`)
- [ ] Hero CTA button 56px height, full-width on mobile
- [ ] Responsive typography (3xl → 5xl)
- [ ] Header height adjusts (64px → 80px)
- [ ] "How it works" cards stack vertically
- [ ] Footer links readable and tappable

### 2. Onboarding Flow (`/onboarding`)
- [ ] Step 1: File upload area large and clear
- [ ] Step 2: Form inputs 48px height minimum
- [ ] Step 3: Company selection cards easily tappable
- [ ] Navigation buttons 48px height
- [ ] Progress indicator visible and clear
- [ ] Error messages clearly displayed

### 3. Offers Overview (`/offers`)
- [ ] Comparison cards stack vertically
- [ ] "View Comparison" button full-width on mobile (48px height)
- [ ] Status badges clearly visible
- [ ] Pending offers section readable
- [ ] Empty state centered and clear

### 4. Comparison Page (`/comparison/:id`)
#### Desktop (md+)
- [ ] 4-column comparison table visible
- [ ] Charts render at normal height (400px)
- [ ] Side-by-side layout maintained

#### Mobile (<md)
- [ ] Table hidden (desktop-only class)
- [ ] MobileComparisonCard displayed instead
- [ ] Charts 300px height for readability
- [ ] Savings banner full-width
- [ ] Action buttons stack vertically (48px height)
- [ ] Missing info section accordion works
- [ ] No horizontal scrolling

### 5. Insurance Check Page (`/check`)
#### Desktop (md+)
- [ ] Market comparison table visible
- [ ] All analysis sections readable

#### Mobile (<md)
- [ ] Market comparison uses MobileComparisonCard
- [ ] Health score banner prominent
- [ ] Strengths/weaknesses cards stack
- [ ] Recommendations list readable
- [ ] "Find better offers" CTA full-width (48px)

### 6. Profile Page (`/profile/:userId`)
- [ ] Tabs scroll horizontally if needed
- [ ] Personal info rows stack (label above value)
- [ ] Edit buttons full-width on mobile (48px)
- [ ] Household member cards readable
- [ ] Document list items tappable
- [ ] Preferences form inputs 48px height

### 7. Email Correspondence (`/emails/:threadId`)
- [ ] Message thread scrollable
- [ ] Quick action buttons wrap and are 40px height
- [ ] Message input 48px height
- [ ] Send button full-width on mobile (48px)
- [ ] Thread messages readable with proper spacing
- [ ] Avatar sizes appropriate

### 8. Upload Offer (`/upload-offer`)
- [ ] File upload area large and clear
- [ ] Form inputs 48px height
- [ ] Submit button full-width (48px)

### 9. Send Inquiry (`/send-inquiry`)
- [ ] Company selection clear
- [ ] Form fields properly sized
- [ ] Submit button accessible

## Component-Level Validation

### MobileComparisonCard Component
- [ ] Renders only on mobile (<md)
- [ ] Each row clearly separated
- [ ] Feature names bold and readable
- [ ] Current/Offer values aligned properly
- [ ] Status badges visible (Better/Worse/Same)
- [ ] Category headers distinguished
- [ ] 16px padding on mobile

### Charts (Recharts)
- [ ] 300px height on mobile
- [ ] 400px height on desktop
- [ ] Responsive container works
- [ ] Legend text readable (12px)
- [ ] Tooltips show on touch
- [ ] No overflow

### Buttons & Inputs
- [ ] Primary buttons: 48px mobile, 40px desktop
- [ ] Small buttons: 40px mobile, 36px desktop
- [ ] All have `touch-target` class where applicable
- [ ] Disabled state clearly visible
- [ ] Loading states show properly

## Performance Checks
- [ ] No layout shift on page load
- [ ] Images lazy load (if applicable)
- [ ] Charts render without jank
- [ ] Smooth scrolling
- [ ] Form validation instant feedback

## Responsive Breakpoints
```css
mobile: 0-767px (default)
md: 768px+
lg: 1024px+
xl: 1280px+
```

### Key Utility Classes Applied
- [ ] `mobile-padding`: px-4 md:px-6
- [ ] `mobile-spacing`: gap-4 md:gap-6
- [ ] `touch-target`: min-h-12 on mobile
- [ ] `desktop-only`: hidden md:block
- [ ] `mobile-only`: block md:hidden

## Final Validation
- [ ] Test all pages at 375px width (iPhone SE)
- [ ] Test all pages at 768px width (iPad portrait)
- [ ] Test all pages at 1024px width (iPad landscape)
- [ ] Verify no horizontal scroll on any page
- [ ] Check touch target spacing
- [ ] Validate form submissions work
- [ ] Ensure all data displays correctly
- [ ] Verify no console errors

## Accessibility Audit
- [ ] Semantic HTML used throughout
- [ ] All images have alt text
- [ ] Form labels properly associated
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Color contrast passes WCAG AA
- [ ] Screen reader friendly

## User Journey Testing
1. [ ] New user: Home → Onboarding → Upload → Send Inquiry → View Offers
2. [ ] Returning user: Login → Offers → Comparison → Email Thread
3. [ ] Insurance check: Home → Check → Analyze → View Results
4. [ ] Profile management: Profile → Edit Info → View Documents

## Notes
- Priority: Mobile-first for 50+ users
- Design system: Subframe + TailwindCSS
- Touch targets critical for accessibility
- No tables on mobile - always use card pattern
- Generous spacing preferred over compact layouts
