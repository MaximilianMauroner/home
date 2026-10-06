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
| H6 | Stretching: discover/select routine, start/pause/advance/complete and restart session. Images, timers and saved state match actions. | Stretching components; session/navigation/hydration tests | Clear owned session. |
| H7 | WhatsApp stats: import fabricated transcript, filter dates/users and inspect known totals. Spotify stats: import fabricated export and inspect known summaries. | tool islands; parsing/metrics tests | Remove owned uploads/storage. |
| H8 | Readwise mapper: establish disposable session, fetch owned data, propose mapping and inspect result. Leaveify: resolve owned source and preview transfer, including partial/error recovery. Provider writes require separate authority. | API tools routes; Leaveify tests | Sign out run session; no provider mutation. |
| H9 | CMS boundary: unauthenticated local reads/writes denied; authorized synthetic content operations only with disposable auth/content store. | admin routes; containment tests | Dispose owned content fixture only. |
| H10 | Privacy, responsive keyboard navigation, accessible labels and both themes across selected tools. No unnecessary sync from local tools. | layouts, privacy route, tool islands | Restore owned profile. |

Account/device/browser gaps must be reported per row. Source/unit proof does not
establish browser imports, rendering, permission prompts or export correctness.
