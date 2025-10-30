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
- Generous click/tap areas (minimum 48x48px on mobile, 44x44px desktop)
- Clear visual feedback for all interactions
- Persistent navigation (no hidden menus)
- Ample whitespace between interactive elements

## Mobile-First Responsive Design

**Breakpoint Strategy:**
- Mobile: < 768px (primary design target)
- Tablet: 768px - 1023px
- Desktop: ≥ 1024px
- Large Desktop: ≥ 1440px

**Core Mobile Principles:**
1. **Mobile-first CSS** - Design for mobile, enhance for desktop
2. **No horizontal scrolling** - Ever. All content must fit viewport width
3. **Touch-optimized** - Minimum 48x48px tap targets with 8px spacing
4. **Progressive enhancement** - Start simple, add complexity on larger screens
5. **Performance-critical** - Lazy load images, reduce bundle size on mobile

## Mobile Component Patterns

### Tables → Stacked Cards Transformation
**Desktop (≥768px):** Traditional 4-column table
```html
<Table>
  <Table.Row>
    <Table.Cell>Feature</Table.Cell>
    <Table.Cell>Current</Table.Cell>
    <Table.Cell>Offer</Table.Cell>
    <Table.Cell>Difference</Table.Cell>
  </Table.Row>
</Table>
```

**Mobile (<768px):** Stacked comparison cards
```html
<div className="space-y-4 md:hidden">
  <Card>
    <CardHeader>Feature Name</CardHeader>
    <div className="grid grid-cols-2 gap-4">
      <div>
        <Label>Nuværende</Label>
        <Value>1,319 kr</Value>
      </div>
      <div>
        <Label>Nyt tilbud</Label>
        <Value>1,049 kr</Value>
      </div>
    </div>
    <Badge>-271 kr/md</Badge>
  </Card>
</div>
```

### Charts on Mobile
**Desktop:** Full-width area/bar charts with detailed axes
**Mobile Adaptations:**
- Reduce data points (show monthly instead of weekly)
- Simplify axes labels
- Use min-height: 300px for touch interaction
- Consider horizontal scroll for timeline charts (with clear indicators)
- Provide "View Full Chart" expansion option

### Navigation Patterns
**Desktop:** Horizontal top nav with breadcrumbs
**Mobile:** 
- Sticky top bar with hamburger menu (min-h-16)
- Bottom navigation bar for primary actions (h-16)
- Breadcrumbs replaced with back button
- Full-screen menu overlays

### Card Grids
**Desktop:** `grid-cols-3 gap-6`
**Tablet:** `md:grid-cols-2 gap-4`
**Mobile:** `grid-cols-1 gap-4`

### Form Layouts
**Desktop:** 2-column form with side-by-side fields
**Mobile:** Single column, full width inputs
- Input height: h-14 (56px)
- Spacing between fields: space-y-6
- Labels above inputs (never beside)
- Full-width buttons

### Spacing Scale Adjustments
**Desktop → Mobile:**
- py-24 → py-12
- py-16 → py-8
- px-8 → px-4
- gap-8 → gap-4
- p-8 → p-6

### Typography Responsive Scale
Apply with Tailwind responsive classes:
```
text-5xl md:text-6xl    // Hero
text-3xl md:text-5xl    // H1
text-2xl md:text-3xl    // H2
text-xl md:text-2xl     // H3
text-base md:text-lg    // Body
```

## Touch Target Guidelines (Critical for 50+ Users)

**Minimum Sizes:**
- Primary buttons: 48px height, full-width on mobile
- Icon buttons: 48x48px minimum
- List items: 56px minimum height
- Checkbox/Radio: 32x32px with 48x48px touch area
- Links in paragraphs: 48px height (generous line-height)

**Spacing Between Touch Targets:**
- Minimum 8px vertical spacing between tappable elements
- Minimum 12px in high-density areas (toolbars, button groups)

**Button Styles Mobile:**
```
Primary: h-14 w-full rounded-lg text-lg font-semibold
Secondary: h-12 w-full rounded-lg text-base
Icon-only: min-w-[48px] min-h-[48px] rounded-lg
```

## Mobile Performance Optimizations

**Images:**
- Use `loading="lazy"` on all non-critical images
- Provide responsive srcset: `<img srcset="image-sm.jpg 480w, image-md.jpg 768w" />`
- WebP format with JPEG fallback
- Max width 1200px on mobile (no need for larger)

**Code Splitting:**
- Lazy load comparison charts (import on scroll)
- Defer non-critical JavaScript
- Inline critical CSS

**Bundle Size:**
- Subframe components: Tree-shake unused components
- Icons: Import only used icons individually
- Fonts: Subset to Danish characters only

## Mobile-Specific Component Rules

### Comparison Cards (Mobile Alternative to Tables)
```tsx
<div className="md:hidden space-y-3">
  <div className="rounded-lg border-2 p-4 space-y-3">
    <div className="font-semibold text-lg">Category Name</div>
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">Nuværende</div>
        <div className="text-base font-medium">Value</div>
      </div>
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">Tilbud</div>
        <div className="text-base font-medium">Value</div>
      </div>
    </div>
    <Badge variant="success">Difference</Badge>
  </div>
</div>
```

### Accordion for Long Content
Replace tabs with accordions on mobile:
```tsx
<Accordion type="single" className="md:hidden">
  <AccordionItem value="item-1">
    <AccordionTrigger className="text-lg py-4">Section</AccordionTrigger>
    <AccordionContent className="px-4 pb-4">Content</AccordionContent>
  </AccordionItem>
</Accordion>
```

### Bottom Sticky Actions
For important CTAs on mobile:
```tsx
<div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
  <Button className="w-full h-14">Primary Action</Button>
</div>
```

## Testing Checklist

**Mobile Viewports:**
- iPhone SE (375px) - Minimum supported
- iPhone 12/13 (390px) - Common
- iPhone 12/13 Pro Max (428px) - Large phone
- iPad Mini (768px) - Tablet breakpoint

**Validation:**
- [ ] No horizontal scroll at any viewport width
- [ ] All touch targets ≥ 48x48px
- [ ] Text readable without zoom (minimum 16px)
- [ ] Forms usable with on-screen keyboard visible
- [ ] Charts interactive and readable
- [ ] Navigation accessible with thumb
- [ ] Images load quickly (<3s on 3G)
- [ ] Critical content above fold

**Subframe Integration Rules:**
When syncing new Subframe components, ensure:
1. Add responsive classes: `className="w-full md:w-auto"`
2. Wrap tables in mobile card alternative: `<div className="hidden md:block"><Table/></div>`
3. Use Tailwind's `md:` prefix for desktop-only features
4. Default to mobile layout, enhance with `md:` and `lg:`
5. Test on 375px width before committing