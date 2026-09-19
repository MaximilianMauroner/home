---
name: Mauroner dev log and article covers
description: Shared site backgrounds with forest article graphics and mint features.
colors:
  forest: "#172725"
  cream: "#edf5e9"
  sage: "#b3c6b8"
  coral: "#ff855e"
  divider: "#405b50"
  mint: "#c1d6b9"
  image-field: "#234333"
  quote-field: "hsl(var(--muted))"
typography:
  display:
    fontFamily: "Geist, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Geist, sans-serif"
    fontSize: "1.125rem"
    lineHeight: 1.8
  label:
    fontFamily: "JetBrains_Mono, monospace"
    fontSize: "0.7rem"
    lineHeight: 1.6
rounded:
  image: "0.5rem"
spacing:
  label-gap: "0.75rem"
  row-gap: "1.5rem"
  row-padding: "1.75rem"
  feature-padding: "2.125rem"
components:
  feature:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.forest}"
    rounded: "{rounded.image}"
    padding: "{spacing.feature-padding}"
  entry:
    textColor: "{colors.cream}"
    padding: "1.75rem 0"
  tag:
    textColor: "{colors.cream}"
    typography: "{typography.label}"
    padding: "0.2rem 0"
  section-navigation:
    textColor: "{colors.sage}"
  quote:
    backgroundColor: "{colors.quote-field}"
    textColor: "{colors.cream}"
    padding: "1.25rem 1.5rem"
---

# Design System: Dev log and article covers

## Overview

**Creative North Star: "Editorial spread"**

This document covers the implemented dev-log surfaces and the shared blog and log cover direction. It records original A, selected by Max. It does not replace the design rules for unrelated site tools or pages.

The visual system uses clear type, shared site backgrounds, and direct graphic explanations. Forest artwork and mint feature panels add site color. The covers avoid the distressed print textures and generic AI illustration treatment rejected during exploration.

**Key Characteristics:**

- Shared page backgrounds with forest artwork, mint features, and coral accents.
- Clear reading hierarchy and compact dated entries.
- Article graphics shown at their full aspect ratio.

## Colors

### Primary

Coral marks links, entry topics, and keyboard focus. Forest forms cover backgrounds and the text on mint feature panels.

### Secondary

Mint identifies the latest-entry title panel. The image field and quote field separate media and quotations from the page through tone.

### Neutral

Cream carries headings and reading text. Sage carries metadata and descriptions. Divider separates archive rows.

The dev-log archive and reading pages use the same StarLayout background as the blog. Their outer surface is transparent. Reading text, muted text, dividers, and quote backgrounds follow the shared light/dark theme tokens. Coral links use a darker rust tone in light mode. Forest stays within cover artwork and mint-panel text, not the page background.

## Typography

Use Geist for headings and reading text. Use JetBrains Mono for dates, entry references, and compact labels. The frontmatter records the repeated roles.

The entry title scales to a slightly smaller maximum than the archive display title (4.125rem). Feature titles scale from 2rem to 2.625rem. Descriptions in archive rows use smaller text (0.94rem) and a shorter line height (1.6).

## Layout

The dev-log container has a maximum width of 72.5rem. Its desktop side space totals 3.5rem. The latest entry shows the image above a mint title panel. Earlier entries use date, content, and arrow columns.

The reading header and cover have a maximum width of 53.125rem. The reading grid has a 12.5rem section-navigation column, a 3.25rem gap, and a text column of up to 42.5rem.

At 760px and below, the reading grid stacks. Page side space totals 2.5rem. Section links wrap above the article. Archive dates sit above each entry title. Keep long titles and tables within the viewport.

## Elevation & Depth

The dev-log uses flat surfaces, thin dividers, and changes in tone. There is no hardware frame or screw detail. The outer background comes from the existing shared StarLayout, including its reduced-motion support; the dev-log adds no separate background animation.

## Shapes

Feature panels and reading images have gently curved corners. Archive entries are open rows separated by a thin line. Tags use an underline with square corners, without a filled pill.

## Components

### Latest-entry feature

Use the full article cover with a mint title panel below it. Show the real date, reference, title, and reading link. Do not add a subtitle. Preserve the cover aspect ratio. A missing cover leaves the title panel.

### Archive entry

Use a date column, a title and description, linked tags, and an arrow link. Keep title view transitions and existing destinations. Hover underlines links. Keyboard focus uses a solid coral outline (3px) with an offset (5px).

### Tags and section navigation

Tags remain links to tag archives. The reading outline links to actual article headings. On desktop it stays beside the text; on mobile it becomes a wrapping list above the text. Existing reading progress and interactive section navigation remain available.

### Quotes

Use the quote field with inset padding. Keep quotation text upright and readable. Do not add decorative quote marks.

### Article covers

Use a simple diagram or graphic based on the article, forest backgrounds, cream panels, and coral accents. Brand logos and essential diagram labels are allowed when they explain the subject accurately. Do not put article headlines, subtitles, slogans, or footer branding inside the artwork. Use the full canvas for the visual.

Show the real article title once as HTML: below the image in previews and above it on reading pages. Cover treatments have no subtitle. Descriptions remain available in content metadata, search data, and compact text-only archive rows. Show the whole cover without color filters or decorative overlays.

Store optimized WebP covers in `src/assets/blog/covers/` and `src/assets/log/covers/`. Reference them through content frontmatter and the existing image loader. Keep instructional screenshots inside articles unchanged.

## Do's and Don'ts

### Do:

- Do preserve original A for the dev-log archive and reading view.
- Do base covers on the article content and the approved site palette.
- Do preserve routes, tags, metadata, reading progress, and section links.

### Don't:

- Don't restore hardware decoration or a separate solid-green page background.
- Don't use distressed textures, glossy 3D scenes, or plain white title cards for this cover direction.
- Don't turn this scoped system into rules for unrelated tools.
