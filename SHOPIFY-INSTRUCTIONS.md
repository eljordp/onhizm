# ONHIZM Store Upgrade — Installation Guide

These files transform your Dawn theme from a generic Shopify template into a branded
dark-mode streetwear storefront with custom typography, new sections, and polished details.

---

## What's Included

```
onhizm-upgrade/
├── custom.css                    ← Visual overhaul (fonts, colors, layout)
├── sections/
│   ├── trust-bar.liquid          ← Shipping / Returns / Secure / Quality icons
│   ├── brand-story.liquid        ← "Our Story" split-image section
│   └── marquee-text.liquid       ← Scrolling text banner (drops, promos)
└── INSTRUCTIONS.md               ← This file
```

---

## Step 1 — Custom CSS (biggest visual impact)

This single step changes fonts, colors, spacing, buttons, and the entire feel.

1. Go to **Shopify Admin → Online Store → Themes**
2. Click **Customize** on your live theme
3. Click **Theme Settings** (gear icon, bottom-left)
4. Scroll down to **Custom CSS**
5. Paste the entire contents of `custom.css` into the box
6. Click **Save**

That's it. Your store now has:
- **Space Grotesk** headings + **Inter** body text
- Dark color scheme (#0a0a0a background, warm cream #e8d5b5 accents)
- Refined button styles with hover animations
- Product card zoom-on-hover
- "Powered by Shopify" is hidden
- Custom scrollbar + selection color
- Fade-in section animations
- Proper spacing and typography scale

> **To revert:** Just delete the CSS from the same box and save.

---

## Step 2 — Add Custom Sections (optional but recommended)

These add new blocks you can drag into your homepage layout.

1. Go to **Shopify Admin → Online Store → Themes**
2. Click the **three dots (⋯)** next to your theme → **Edit code**
3. In the left sidebar, find the **Sections** folder
4. Click **Add a new section**
5. Name it exactly as shown, then paste the file contents:

| File to paste | Name it |
|---|---|
| `sections/trust-bar.liquid` | `trust-bar` |
| `sections/brand-story.liquid` | `brand-story` |
| `sections/marquee-text.liquid` | `marquee-text` |

6. Click **Save** for each

---

## Step 3 — Add sections to your homepage

1. Go back to **Customize** (theme editor)
2. On your homepage, click **Add section**
3. You'll now see **Trust Bar**, **Brand Story**, and **Marquee Text** as options
4. Recommended homepage order:

```
- Header
- Announcement Bar
- [Marquee Text]         ← "NEW DROP — LIMITED EDITION" scrolling banner
- Hero Banner (existing)
- [Trust Bar]            ← Shipping / Returns / Secure / Quality
- Featured Collection (existing)
- [Brand Story]          ← Image + "Our Story" text
- Newsletter (existing)
- Footer
```

5. Click into each new section to customize the text, images, and settings
6. **Save**

---

## Step 4 — Quick wins in Shopify Admin

These don't need any code:

- [ ] **Remove "Powered by Shopify"**: Already hidden by CSS, but also go to
      Online Store → Themes → ⋯ → Edit default theme content → uncheck it
- [ ] **Fix the gallery placeholders**: In the theme editor, find the multicolumn/gallery
      section with "Title 1", "Title 2", "Title 3" and replace with real captions
- [ ] **Add more nav links**: Go to Online Store → Navigation → Main menu → Add:
      - "About" (link to a new page you create)
      - "Lookbook" (link to a collection or page)
      - "FAQ" or "Sizing" (link to a new page)
- [ ] **Favicon**: Settings → Brand → Add a square version of your heart logo as favicon
- [ ] **Product pages**: Add fabric details, size guides, and multiple photo angles
      (especially for the $200 sweatsuit)

---

## Color Reference

If you want to tweak the colors, edit these CSS variables in `custom.css`:

| Variable | Current | What it controls |
|---|---|---|
| `--color-bg` | `#0a0a0a` | Page background |
| `--color-bg-card` | `#141414` | Card/section backgrounds |
| `--color-text` | `#f5f5f0` | Main text |
| `--color-text-muted` | `#a0a09a` | Secondary text |
| `--color-accent` | `#e8d5b5` | Buttons, highlights, links |
| `--color-border` | `#2a2a2a` | Dividers, borders |

---

## Notes

- All CSS uses `!important` to override Dawn's defaults. This is normal for custom CSS.
- The sections use CSS variables from `custom.css`, so install the CSS first.
- Everything is reversible — delete the CSS or remove sections to go back to default.
- Test on mobile after installing. The CSS includes responsive breakpoints but check your
  specific content.
