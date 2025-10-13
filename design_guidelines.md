# Danish Insurance Comparison Platform - Design Guidelines

## Design Approach
**Selected Framework:** Accessibility-First Design System combining Apple HIG minimalism with Material Design's clear visual hierarchy, specifically tailored for 50+ demographics.

**Core Principles:**
- Radical clarity over visual complexity
- Trust through simplicity and transparency
- Effortless comprehension with zero cognitive friction

## Color System

**Light Mode (Primary):**
- Primary: 210 65% 25% (Deep trustworthy blue)
- Primary Hover: 210 65% 20%
- Secondary: 210 20% 96% (Soft blue-grey backgrounds)
- Accent: 145 60% 40% (Confident green for CTAs/success)
- Text Primary: 220 15% 15% (High contrast near-black)
- Text Secondary: 220 10% 45%
- Border: 220 15% 85%
- Error: 0 70% 50%
- Warning: 35 90% 50%

**Dark Mode:**
- Background: 220 15% 12%
- Surface: 220 12% 18%
- Text Primary: 220 15% 95%
- Preserve accent colors with adjusted lightness for WCAG AAA compliance

## Typography

**Font Stack:**
- Primary: 'Inter', system-ui, -apple-system (excellent screen readability)
- Display: 'Inter', weight 600-700

**Scale (Desktop):**
- Hero: text-6xl (3.75rem) font-semibold leading-tight
- H1: text-5xl (3rem) font-semibold
- H2: text-3xl (1.875rem) font-semibold
- H3: text-2xl (1.5rem) font-semibold
- Body Large: text-xl (1.25rem) - primary interface text
- Body: text-lg (1.125rem) - standard reading
- Small: text-base (1rem) - metadata/labels

**Mobile Scale:**
- Reduce by one size level (Hero → text-5xl, Body Large → text-lg)

**Critical:** Minimum body text 18px (text-lg), line-height 1.6-1.8 for optimal readability

## Layout System

**Spacing Primitives:** Tailwind units of 4, 6, 8, 12, 16, 24
- Component padding: p-6 to p-8
- Section spacing: py-16 to py-24
- Card gaps: gap-6 to gap-8
- Element margins: mb-4, mb-6, mb-8

**Container Widths:**
- Max content: max-w-7xl
- Forms/comparisons: max-w-5xl
- Text content: max-w-3xl

**Grid Patterns:**
- Comparison cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Form steps: Single column max-w-2xl for focus
- Feature sections: 2-column on desktop (text + visual)

## Component Library

**Cards:**
- Large corner radius (rounded-xl to rounded-2xl)
- Prominent borders (border-2) with hover states
- Generous padding (p-8 to p-12)
- Clear visual hierarchy with bold headings
- Pricing: Large numbers (text-4xl to text-5xl font-bold)

**Buttons:**
- Primary CTA: Large size (h-14 to h-16), px-8, text-lg, accent color
- Secondary: variant="outline", border-2, same sizing
- Icon buttons: Minimum 44x44px touch targets
- On images: variant="outline" with backdrop-blur-md bg-white/20

**Forms:**
- Multi-step progress: Large numbered circles with connecting lines
- Input fields: h-14, text-lg, rounded-lg, border-2
- Labels: text-base font-semibold mb-3
- Helper text: text-base text-muted-foreground
- Error states: border-error with text-error message below
- Radio/Checkbox: Oversized (scale-125) with large labels

**Status Badges:**
- Large size: px-4 py-2 text-base font-semibold
- High contrast colors: Green (approved), Blue (pending), Red (action needed)
- Rounded-full for pill shape

**Navigation:**
- Sticky header: h-20, large logo, text-lg menu items
- Clear active states with underline or background highlight
- Prominent "Get Quote" CTA in header (accent color)

## Images

**Hero Section:**
- Large hero image (60vh desktop, 50vh mobile)
- Image: Mature Danish couple reviewing documents at bright kitchen table, natural lighting, authentic photography (not stock-looking)
- Overlay: Subtle gradient (from-black/40 to-transparent) for text legibility
- Hero content: Left-aligned or centered, white text with text-shadow-lg

**Supporting Imagery:**
- Trust indicators: Danish landmarks/symbols subtly integrated
- Process visuals: Clean iconography showing comparison steps
- Testimonial sections: Real customer photos (diverse 50+ age range)
- Background patterns: Minimal, low-contrast geometric shapes if needed

## Page Structure

**Homepage:**
1. Hero with large headline + immediate quote CTA
2. Trust bar (logos/certifications) - py-12
3. How it works (3-step visual process) - py-24
4. Featured insurance types (card grid) - py-24
5. Benefits section (2-column layout) - py-24
6. Social proof (large testimonials) - py-24
7. Final CTA (prominent, different visual treatment) - py-24
8. Footer (comprehensive links, contact, compliance info)

**Comparison Tool:**
- Step indicator (always visible, large numbers)
- Single focus per step (max 3-4 inputs visible)
- Large "Continue" button (accent color, h-16, full-width on mobile)
- Results: Card-based grid with clear comparison metrics
- Sticky comparison bar when scrolling

## Accessibility Enhancements

- Focus rings: 3px solid accent color, offset-2
- Skip links: Large, high contrast
- Form validation: Instant, clear error messages
- Keyboard navigation: Visible, logical tab order
- Color blind safe: Never rely on color alone for information
- Motion: Respect prefers-reduced-motion

**Critical for 50+ Users:**
- No auto-advancing carousels
- Generous click/tap areas (minimum 44x44px)
- Clear visual feedback for all interactions
- Persistent navigation (no hidden menus)
- Ample whitespace between interactive elements