# Danish Insurance Comparison Platform - Design Guidelines

## Design Approach
**Selected Framework:** Subframe Design System with accessibility-first approach tailored for 50+ demographics.

**Core Principles:**
- Radical clarity over visual complexity
- Trust through simplicity and transparency
- Effortless comprehension with zero cognitive friction
- Use ONLY Subframe typography - no custom font sizes

## Typography System (Subframe Only)

**CRITICAL:** Use ONLY these Subframe typography classes. Never use text-lg, text-xl, or custom sizes.

**Available Font Sizes:**
- `text-caption font-caption` - 12px, 400 weight, 16px line-height
- `text-caption-bold font-caption-bold` - 12px, 500 weight, 16px line-height
- `text-body font-body` - 14px, 400 weight, 20px line-height
- `text-body-bold font-body-bold` - 14px, 500 weight, 20px line-height
- `text-heading-3 font-heading-3` - 16px, 600 weight, 20px line-height
- `text-heading-2 font-heading-2` - 20px, 600 weight, 24px line-height
- `text-heading-1 font-heading-1` - 30px, 600 weight, 36px line-height

**Font Family:** Inter Tight (applied automatically by Subframe)

**Usage Guidelines:**
- Page titles: `text-heading-1 font-heading-1`
- Section headers: `text-heading-2 font-heading-2`
- Subsection headers: `text-heading-3 font-heading-3`
- Emphasized text: `text-body-bold font-body-bold`
- Body text: `text-body font-body`
- Small labels/metadata: `text-caption font-caption`
- Emphasized labels: `text-caption-bold font-caption-bold`

**Mobile Responsive Typography:**
```
text-heading-1 font-heading-1 mobile:text-heading-2 mobile:font-heading-2
text-heading-2 font-heading-2 mobile:text-heading-3 mobile:font-heading-3
```

## Color System (Subframe)

**Primary Colors:**
- Brand: `brand-{50-900}` - Teal/cyan for primary actions
- Neutral: `neutral-{0,50-950}` - Grays for UI elements
- Success: `success-{50-900}` - Green for positive states
- Warning: `warning-{50-900}` - Orange for warnings
- Error: `error-{50-900}` - Red for errors

**Semantic Colors:**
- `default-font` - rgb(17, 24, 39) - Primary text
- `subtext-color` - rgb(107, 114, 128) - Secondary text
- `neutral-border` - rgb(229, 231, 235) - Borders
- `default-background` - rgb(255, 255, 255) - Page background

## Layout System

**Spacing (Subframe Standard):**
- Use Tailwind spacing: gap-2, gap-3, gap-4, gap-6, gap-8
- Component padding: px-4 py-4, px-6 py-6
- Mobile: Reduce by one level (px-6 → px-4)

**Container Widths:**
- Max content width: max-w-[768px]
- Center with mx-auto
- Mobile padding: px-4 mobile:px-3

**Responsive Patterns:**
```
flex-col mobile:flex-col     // Stack on mobile
gap-6 mobile:gap-4            // Tighter spacing on mobile
px-6 mobile:px-4              // Less padding on mobile
```

## Component Guidelines

**Buttons:**
- Primary: `h-12` (touch-target class for 48px)
- Full-width on mobile: `mobile:w-full`
- Icon buttons: Minimum 48x48px
- Always use `touch-target` class for accessibility

**Cards:**
- Border: `border border-solid border-neutral-border`
- Background: `bg-default-background` or `bg-neutral-50`
- Padding: `px-6 py-6 mobile:px-4 mobile:py-4`
- Radius: `rounded-lg` or `rounded-md`

**Badges:**
- Variants: success, error, warning, neutral, brand
- Always include icons where appropriate
- Use for status indicators

**Icons:**
- Use `IconWithBackground` for featured icons
- Sizes: small, medium, large
- Variants: success, error, warning, neutral, brand

## Mobile-First Design

**Critical Mobile Rules:**
1. **No custom font sizes** - Use Subframe typography only
2. **Touch targets ≥48px** - Use `h-12` minimum, apply `touch-target` class
3. **No horizontal scroll** - Test at 375px width
4. **Mobile-first classes** - Default to mobile, enhance with `mobile:` prefix

**Mobile Class Patterns:**
```
// Layout
flex-col mobile:flex-col mobile:flex-nowrap
items-center mobile:items-start

// Spacing  
gap-6 mobile:gap-4
px-6 py-6 mobile:px-4 mobile:py-4

// Sizing
h-12 mobile:h-auto mobile:min-h-[48px]
w-full mobile:w-full

// Typography
text-heading-2 font-heading-2 mobile:text-heading-3 mobile:font-heading-3
text-body font-body mobile:text-caption mobile:font-caption

// Visibility
hidden mobile:flex  // Show only on mobile
flex mobile:hidden  // Hide on mobile
```

**Table → Mobile Cards:**
Desktop tables MUST transform to cards on mobile:
```tsx
// Desktop: Scrollable table
<div className="overflow-x-auto">
  <div className="min-w-[576px]">
    <Table>...</Table>
  </div>
</div>

// Mobile alternative not needed - tables scroll horizontally
```

## Accessibility (50+ Users)

**Touch Targets:**
- Minimum 48x48px (h-12 class)
- Use `touch-target` utility class
- 8px spacing between targets

**Typography:**
- Minimum: text-caption (12px) for labels only
- Standard: text-body (14px) for most text
- Important: text-body-bold or larger for emphasis

**Contrast:**
- Text: Use `text-default-font` or `text-subtext-color`
- Backgrounds: High contrast with text
- Interactive elements: Clear hover/focus states

## Component Library Reference

**From Subframe:**
- Button
- Badge
- IconWithBackground
- DefaultPageLayout
- AreaChart
- Avatar
- TextField
- Dialog

**Typography Classes (Complete List):**
- text-caption font-caption
- text-caption-bold font-caption-bold
- text-body font-body
- text-body-bold font-body-bold
- text-heading-3 font-heading-3
- text-heading-2 font-heading-2
- text-heading-1 font-heading-1

**Border Radius:**
- rounded-sm: 4px
- rounded-md: 8px
- rounded-lg: 12px
- rounded-full: 9999px

**Shadows:**
- shadow-sm: Subtle
- shadow-md: Medium
- shadow-lg: Large

## Testing Checklist

**Typography Validation:**
- [ ] NO text-lg, text-xl, or custom sizes used
- [ ] ALL text uses Subframe typography classes
- [ ] Mobile typography uses mobile: prefix correctly

**Mobile Validation (Test at 375px):**
- [ ] No horizontal scroll
- [ ] All touch targets ≥ 48px
- [ ] Typography readable (minimum text-caption for labels)
- [ ] Proper spacing (gap-4, px-4, py-4 on mobile)
- [ ] Full-width buttons on mobile

**Accessibility:**
- [ ] High contrast text (WCAG AAA)
- [ ] Touch targets ≥ 48px with spacing
- [ ] Clear focus states on interactive elements
- [ ] No reliance on color alone
