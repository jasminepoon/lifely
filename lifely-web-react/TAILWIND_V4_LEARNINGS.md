# Tailwind CSS v4 Learnings

> **Date**: 2025-12-11
> **Context**: Lifely React app migration from custom theme variables to standard Tailwind

---

## The Problem

Tailwind CSS v4's `@theme` directive for custom CSS variables **does not reliably generate utility classes**.

### What Didn't Work

```css
/* index.css - @theme block */
@theme {
  --color-bg-card: #111827;
  --color-accent-cyan: #00D4FF;
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-border-default: rgba(255, 255, 255, 0.1);
}
```

Expected these to generate utilities:
- `bg-bg-card` → background: #111827
- `text-text-primary` → color: #F9FAFB
- `border-border-default` → border-color: rgba(255,255,255,0.1)

**Result**: Classes were not applied. Elements rendered with no background/color/border.

### Symptoms

1. **Missing gradients**: `text-gradient` class with CSS custom property didn't render
2. **Broken layouts**: Cards rendered as tall/narrow strips
3. **Invisible text**: Text using `text-text-primary` was invisible
4. **No backgrounds**: `bg-bg-card` showed transparent backgrounds
5. **Grid failures**: `grid grid-cols-3` didn't create columns

---

## The Solution

**Use standard Tailwind color classes and inline styles** instead of custom theme variables.

### Color Mapping

| Custom Variable | Standard Tailwind |
|----------------|-------------------|
| `bg-bg-base` | `bg-slate-900` |
| `bg-bg-card` | `bg-gray-900` |
| `bg-bg-elevated` | `bg-gray-800` |
| `text-text-primary` | `text-white` |
| `text-text-secondary` | `text-gray-400` |
| `text-text-muted` | `text-gray-500` |
| `text-accent-cyan` | `text-cyan-400` |
| `text-accent-warm` | `text-red-400` |
| `border-border-default` | `border-white/10` |
| `border-border-active` | `border-cyan-400/40` |

### Gradient Fix

**Before** (broken):
```tsx
<h1 className="text-gradient">2025</h1>
```

**After** (working):
```tsx
<h1
  style={{
    background: 'linear-gradient(90deg, #00D4FF 0%, #00FF88 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }}
>
  2025
</h1>
```

### Glassmorphism Fix

**Before** (broken):
```tsx
<div className="glass glow-cyan">...</div>
```

**After** (working):
```tsx
<div
  style={{
    background: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 0 30px rgba(0, 212, 255, 0.15)',
  }}
>
  ...
</div>
```

### Grid/Flex Fix

**Before** (unreliable):
```tsx
<div className="grid grid-cols-3 gap-4">
  <StatCard />
  <StatCard />
  <StatCard />
</div>
```

**After** (reliable):
```tsx
<div className="flex gap-4">
  <div className="flex-1">...</div>
  <div className="flex-1">...</div>
  <div className="flex-1">...</div>
</div>
```

### Arbitrary Value Syntax Fix

Arbitrary values in brackets like `grid-cols-[140px_1fr_44px]` may not generate properly.

**Before** (broken):
```tsx
<div className="grid grid-cols-[140px_1fr_44px] gap-3">
```

**After** (working):
```tsx
<div className="grid gap-3" style={{ gridTemplateColumns: '140px 1fr 44px' }}>
```

### Flex Container Centering Fix

**Critical Issue**: `flex items-center justify-center` with a `w-full` child causes the child to shrink to minimum content width (each word on a separate line).

**Before** (broken - child shrinks to ~50px wide):
```tsx
<section className="min-h-screen flex items-center justify-center px-4">
  <div className="w-full max-w-lg">
    {/* Content wraps at every word */}
  </div>
</section>
```

**After** (working):
```tsx
<section className="min-h-screen flex flex-col items-center justify-center px-4">
  <div className="w-full max-w-lg">
    {/* Content renders at proper width */}
  </div>
</section>
```

**Why this works**:
- In `flex-row` (default), child width is affected by flex calculations. `w-full` doesn't override flex-shrink behavior.
- In `flex-col`, the main axis is vertical, so `w-full` on a child works as expected for horizontal width.

### CSS-in-CSS @apply Fix

`@apply` with custom theme variables doesn't work.

**Before** (broken):
```css
body {
  @apply bg-bg-base text-text-primary antialiased;
}
```

**After** (working):
```css
body {
  background-color: #0A0F1A;
  color: #F9FAFB;
  @apply antialiased;
}
```

---

## Best Practices for Tailwind v4

1. **Stick to standard Tailwind colors** (`gray-*`, `cyan-*`, `white`, etc.)
2. **Use inline styles for complex gradients** and glassmorphism effects
3. **Prefer `flex` over `grid`** for simple equal-width layouts
4. **Test visually after every change** - utilities may silently fail
5. **Keep custom CSS classes minimal** - only for animations that can't be done inline
6. **Always use `flex-col`** for vertical centering patterns with width-constrained children
7. **Avoid arbitrary value syntax** like `grid-cols-[...]` - use inline styles instead
8. **Don't use `@apply` with custom theme variables** - use direct CSS values

---

## Files Changed

### Components fixed:
- `hero-text.tsx` - gradient text
- `glass-card.tsx` - glassmorphism
- `button.tsx` - all variants
- `message-box.tsx` - card backgrounds
- `progress-bar.tsx` - gradient fill
- `progress-dots.tsx` - accent colors
- `landing-page.tsx` - all text colors
- `modals.tsx` - Modal container, HowItWorksModal, PermissionsModal, PermissionItem (all layout converted to inline styles)
- `bar-row.tsx` - grid-cols arbitrary value → inline style
- `results-page.tsx` - accent color class
- `index.css` - body @apply with theme variables

### Beat components (all 7 fixed for flex-col centering):
- `hero.tsx` - gradient, flex layout, `flex-col` added
- `people.tsx` - `flex-col` added
- `places.tsx` - `flex-col` added
- `rituals.tsx` - `flex-col` added
- `patterns.tsx` - `flex-col` added
- `narrative.tsx` - `flex-col` added
- `experiments.tsx` - `flex-col` added

### Pattern fixes:
- `bg-bg-*` → `bg-gray-*`
- `text-text-*` → `text-white`, `text-gray-*`
- `text-accent-*` → `text-cyan-*`, `text-red-*`
- `border-border-*` → `border-white/*`
- `border-accent-*` → `border-cyan-*`
- `text-gradient` → inline style
- `glass` → inline style
- `glow-*` → inline boxShadow
- `grid-cols-[arbitrary]` → inline gridTemplateColumns
- `flex items-center justify-center` → `flex flex-col items-center justify-center`
- `@apply bg-bg-base` → direct CSS values

---

## Root Cause Hypothesis

The `@theme` directive in Tailwind v4 may:
1. Not be fully supported in Vite's CSS processing pipeline
2. Require additional configuration not documented
3. Have issues with certain variable naming patterns
4. Not generate utility classes at build time

The flex container width issue is likely due to:
1. Tailwind v4's flex utilities interacting differently with child width calculations
2. In `flex-row`, `w-full` on children doesn't prevent flex-shrink, causing min-content collapse
3. `flex-col` changes the calculation axis, making `w-full` work as expected

**Recommendations**:
1. Avoid `@theme` custom colors until Tailwind v4 is more mature
2. Use standard colors or CSS custom properties directly in inline styles
3. Use `flex flex-col items-center justify-center` for vertical centering patterns
4. Use inline styles for any arbitrary values (grid-template-columns, etc.)

---

## Critical Update: Tailwind v4 Layout Utilities Broken

**Discovery Date**: 2025-12-11

After further testing, we found that **most Tailwind v4 utility classes silently fail**. The following patterns consistently break:

### Broken Layout Utilities

| Class | Expected | Result |
|-------|----------|--------|
| `flex` | display: flex | No effect |
| `grid` | display: grid | No effect |
| `flex-wrap` | flex-wrap: wrap | No effect |
| `gap-*` | gap: value | No effect |
| `w-full` | width: 100% | No effect |
| `max-w-lg` | max-width: 32rem | No effect |
| `h-*` | height: value | No effect |
| `space-y-*` | margin-top on children | No effect |

### Solution: Use Inline Styles for Everything

Since Tailwind v4 utility classes cannot be trusted, **use inline styles for all critical layout properties**:

```tsx
// BAD - Tailwind v4 classes silently fail
<div className="flex flex-wrap gap-2 w-full max-w-lg">

// GOOD - Inline styles always work
<div style={{
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.5rem',
  width: '100%',
  maxWidth: '32rem'
}}>
```

### Complete Component Pattern

For horizontal scroll pages with snap:

```tsx
<section
  style={{
    minWidth: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    scrollSnapAlign: 'start',
    flexShrink: 0,
  }}
>
  <div style={{ width: '100%', maxWidth: '32rem' }}>
    {/* Content */}
  </div>
</section>
```

### Classes That Still Work

Some Tailwind classes still work (typically those that map to simple CSS properties):
- `px-4`, `py-16` (padding)
- `text-white`, `text-gray-400` (text colors)
- `rounded-xl` (border-radius)
- `reveal-up` (custom animation class)

### Conclusion

**For Tailwind v4 with Vite, treat inline styles as the primary styling method.** Only use Tailwind classes for:
1. Padding/margin (works sometimes)
2. Custom animation classes defined in CSS
3. Simple text colors (use standard palette only)

For any layout-critical properties (display, flex, grid, width, height, gap), always use inline styles.
