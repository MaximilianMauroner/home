---
name: Mauroner dev log, blog pages, and article covers
description: Shared site backgrounds. Dev log uses forest graphics and mint features; blog pages and blog covers use Open night ink and ember.
colors:
  forest: "#172725"
  cream: "#edf5e9"
  sage: "#b3c6b8"
  coral: "#ff855e"
  divider: "#405b50"
  mint: "#c1d6b9"
  image-field: "#234333"
  quote-field: "hsl(var(--muted))"
  blog-paper: "#f2ecdd"
  blog-ink: "#1d2747"
  blog-contour: "#8790b5"
  blog-marker: "#b93d14"
  night-surface: "rgb(4 5 9 / 0.7)"
  night-ink: "#f1e8d4"
  night-contour: "#3d4a78"
  ember: "#ff8a4c"
  cover-ink: "#101629"
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

This document covers the implemented dev-log surfaces, the blog pages, and the blog and log cover direction. For the dev log it records original A, selected by Max. For blog pages and blog covers it records Open night (exploration `blog-spark`, node B2), selected by Max on 2026-10-06. Max rejected the forest green in dark mode and found a neutral grey boring. It does not replace the design rules for unrelated site tools or pages.

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

### Blog pages: Open night

Blog pages keep the topographic map idea: a header card with contour rings and a pin, a reading panel on a fine grid, and a related trail. The goal is "polished with a little spark".

- Light mode: navy ink on cream paper, periwinkle contours, rust-ember marker.
- Dark mode: translucent near-black surfaces, so the StarLayout starfield shows faintly through the cards. Thin cream borders at 20% define the edges. Cream ink, blue contours, ember marker.
- The spark: contour rings step from the contour colour to the pin colour, like elevation bands. The pin has a static halo. Each section heading (h2) has a small marker waypoint dot.
- Polish: soft offset shadows with blur, not zero-blur block shadows. Text selection, link underlines, and focus rings use the marker colour. Card hover lifts slightly and gains an ember shadow.
- `--map` stays solid because article visuals use it for fills and text. Translucent card backgrounds use `--surface` and `--panel`.
- No continuous animation. Link and card transitions respect reduced motion.

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

Use a simple diagram or graphic based on the article, with cream panels and coral accents. Blog covers use a deep navy background (`#101629`) with slate-blue linework. Keep the fine coordinate grid, corner contour rings, and restrained coral waypoints consistent across the cover series. Dev-log covers keep forest backgrounds. Brand logos and essential diagram labels are allowed when they explain the subject accurately. Do not put article headlines, subtitles, slogans, or footer branding inside the artwork. Use the full canvas for the visual.

Show the real article title once as HTML: below the image in previews and in the title header on reading pages. Cover treatments have no subtitle. Descriptions remain available in content metadata, search data, and compact text-only archive rows. Show the whole cover without color filters or decorative overlays.

Blog reading pages integrate the full cover into the title header. On desktop, the headline and artwork sit beside each other; at 720px and below, the artwork sits above the headline. Both appear before the topics and reading details. Preserve the whole image and descriptive alt text. Keep the writing directly after the header. Archive and related-post covers keep their existing presentation.

Store optimized WebP covers in `src/assets/blog/covers/` and `src/assets/log/covers/`. Reference them through content frontmatter and the existing image loader. Keep instructional screenshots inside articles unchanged.

## Navigation motion

Public pages use native cross-document View Transitions with normal document
navigation. Fade the main content for 160 ms. Shared archive and reading titles,
plus blog covers, change position and size over 200 ms. Keep the header, footer,
and starfield still during navigation. Use unique names derived from the content
family and full entry ID, with `/` replaced by `-`.

Disable navigation transitions for `prefers-reduced-motion: reduce`. Browsers
without support use normal navigation. Keep chart state changes on their existing
CSS and Web Animations paths. The admin layout retains its active Astro router;
the native navigation stylesheet belongs to the public DefaultLayout.

## Tools directory

The `/tools/` directory groups tools into Music & sound, Photos & design,
Data & reading, Movement, and AI experiments. Use a wide asymmetric grid on
desktop, two columns on tablets, and a single column on phones. The individual
tools are open rows within each group, with one access label and an optional
status label. The route exports and tool catalog remain the inventory.

Keep the shared starfield and site header. Group headers use muted mint, gold,
blue, coral, and violet fields with simple diagrams based on the tools. Use Geist
and the shared light/dark theme. Give Leaveify and Photo Journey larger titles.
The contrast trainer includes a small visual sample of its challenge.

Category links jump to the group. Search and the account filter are progressive
enhancements; the full directory and links work without JavaScript. Filtered
groups fill the available width. Keep hover movement short and stop it under
reduced motion. Navigation uses the shared native View Transitions.

## Do's and Don'ts

### Do:

- Do preserve original A for the dev-log archive and reading view.
- Do base covers on the article content and the approved site palette.
- Do use Open night for blog pages and blog covers in both themes.
- Do preserve routes, tags, metadata, reading progress, and section links.

### Don't:

- Don't restore hardware decoration or a separate solid-green page background.
- Don't use forest green on blog pages, and don't replace it with a flat neutral grey.
- Don't use distressed textures, glossy 3D scenes, or plain white title cards for this cover direction.
- Don't turn this scoped system into rules for unrelated tools.

## Topic atlas

The tags index and individual tag archives use the blog’s Open night palette,
shared starfield, Geist headings, and compact mono dates and counts. Keep tag
URLs and page metadata. Show an alphabetical topic index with real post counts,
and an atlas panel with six frequent topics on the index or six related topics
on a tag archive. Rank related topics by the number of posts shared with the
selected tag; use alphabetical order to break ties.

Show writing as open rows with collection, date, title, description, and topic
links. Full-text search keeps relevance order and shows the matching passage.
Topic links retain the current search query. Native links and the collapsible
topic index work before hydration; full-text search loads on demand. On phones,
use a bounded two-column topic index and stack the atlas above the writing.
