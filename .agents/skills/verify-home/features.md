# Feature map

Reusable procedure map. The route tree and tool catalog own inventory.
A map does not establish a completed live audit.

| ID | Public action and expected result | Source / supporting tests | Reset |
| --- | --- | --- | --- |
| H1 | Browse home/blog/dev-log/snacks/tags and published article; follow section/related links and search. Published content, dates and metadata match schema. RSS/search-index/OG routes return proper output. | content schemas, page routes; post-search tests | Read-only. |
| H2 | Filter tools catalog by category/privacy and open active tools. Inactive malen-nach-zahlen stays marked inactive. | toolCatalog and tools pages | Clear filter. |
| H3 | Pace calculator: convert known distance/time and inspect splits. Colour game: complete a round. AI acceptability: answer all prompts and inspect scoring. AI city simulator: start/reset an owned simulation. | corresponding islands; scoring tests | Reset owned state. |
| H4 | Microphone tester: deny then grant owned permission, observe bounded input and stop. Physical audio needs human observation. | microphone metrics/tests | Stop tracks, revoke run permission. |
| H5 | Photo journey: import committed manual-journey photos, inspect dates/map/review, play/pause/reorder, save/reopen project, export image/video/archive. Missing metadata stays explicit. | PhotoJourney components; photo-journey tests | Clear only owned origin/project/downloads. |
| H6 | Stretching: discover/select routine, start/pause/advance/complete and restart session. In Routine Studio create a fabricated routine, edit/save/reopen/start/delete it, reject an empty draft and repair an empty saved routine. Images, timers and saved local state match actions. | Stretching components; session/navigation/hydration tests | Delete fabricated custom routines; clear only run-owned routine/session storage. |
| H7 | WhatsApp stats: import fabricated transcript, filter dates/users and inspect known totals. Spotify stats: import fabricated export and inspect known summaries. | tool islands; parsing/metrics tests | Remove owned uploads/storage. |
| H8 | Readwise mapper: establish disposable session, fetch owned data, propose mapping and inspect result. Leaveify: resolve owned source and preview transfer, including partial/error recovery. Provider writes require separate authority. | API tools routes; Leaveify tests | Sign out run session; no provider mutation. |
| H9 | CMS boundary: unauthenticated local reads/writes denied; authorized synthetic content operations only with disposable auth/content store. | admin routes; containment tests | Dispose owned content fixture only. |
| H10 | Privacy, responsive keyboard navigation, accessible labels and both themes across selected tools. No unnecessary sync from local tools. | layouts, privacy route, tool islands | Restore owned profile. |

Account/device/browser gaps must be reported per row. Source/unit proof does not
establish browser imports, rendering, permission prompts or export correctness.

## H6 responsive stretching matrix

Use a fresh owned origin. Check direct URLs for `?view=browser`,
`?view=preview&routine=routine_1`, `?view=active`, and
`?view=content-manager` after hydration. Require no hydration errors.

- Check overview, browser, preview, active, rest, completion, Studio, routine
  form, stretch form, image picker, preview dialog, and settings at 320×568,
  375×667, 390×844, 412×915, 844×390, 768×1024, 1024×768, and 1440×1000.
  Require no horizontal page overflow. Active essentials and controls must fit
  the viewport. Guidance can scroll in its own panel. Long sequence rails can
  scroll horizontally within their own control. Repeat light and dark themes.
- Scroll discovery: search stays visible and categories remain in one scrollable
  mobile row. Combine a search, category, and difficulty; inspect expected
  results and the empty state, then reset. Check image fallbacks.
- Scroll preview through the movement order. Begin stays reachable on phone
  and tablet and in the desktop summary. Open a movement preview and close
  with Escape; focus returns to its trigger.
- Start, pause, resume, advance through repetition/rest, skip rest, finish,
  restart, and exit. Check timer pause and automatic transitions with short
  fabricated durations. Phase announcements change without announcing every tick.
- Settings: choose a preset, cancel, and reopen; no change was applied. Choose
  and apply another preset; it persists. Space and arrows in settings must not
  start or advance the session. Keyboard activation of buttons remains native.
- Studio: use Move up/down by pointer and keyboard, and desktop drag. Check
  sequence order and the move announcement. Cancel a close or routine switch
  after changing a draft; changes remain. Save a fabricated custom routine,
  reopen it, check metadata, start it, and confirm deletion. Reject deletion
  once and confirm it once. Built-in routines remain unchanged.
- Edit a stretch, cancel a dirty form and reject discard, open the image picker,
  filter/search, select then cancel, confirm another choice, remove an image,
  and try a custom URL and failed-image fallback. Form text survives picker use.
  Check modal focus containment and restoration. Check reduced motion.

Record browser engine, viewport evidence, pointer/keyboard evidence, and touch
input evidence separately. Resizing Chromium does not verify physical iOS,
Android, Safari, Firefox, or a touch gesture. Report unavailable hardware/engines
as gaps. No inaccessible device is counted as passed.
