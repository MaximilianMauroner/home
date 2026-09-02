# Suwayomi Backfill Controller

This service keeps Suwayomi's automatic downloader disabled and schedules one
chapter per provider, with limits from `provider_cap` and
`provider_cooldown_seconds`. It verifies CBZ files before moving them into
Kavita's library and stores durable state in SQLite. If the download and
library paths are ever on different filesystems, it validates the copied CBZ
before removing the source.

`ingested` means the controller has an active file row with a path, SHA-256,
canonical title, and chapter number that match an existing library file.
Suwayomi's `isDownloaded` value does not satisfy that condition by itself.

When a chapter fails, its provider enters progressive backoff. Fresh chapters
are attempted before that failed chapter is retried, so one dead CDN object
cannot stall every other title on the provider.

The controller also owns downloader liveness. It restarts Suwayomi whenever
tracked queue work exists while the downloader is stopped, records progress
heartbeats, and moves a chapter into the existing provider backoff/fallback
flow when its progress remains unchanged for `download_stall_seconds` (15
minutes by default). Enqueueing is persisted before downloader startup so a
startup timeout cannot leave untracked queue work.

`title_priority` changes ordering within a category without changing request
rates. The deployed configuration puts One Piece first in Reading.

Typical commands:

```sh
python controller.py --config config.json plan
python controller.py --config config.json audit
python controller.py --config config.json inventory-title 226
python controller.py --config config.json dashboard
python controller.py --config config.json run
python controller.py --config config.json run --once --source MangaDex
python controller.py --config config.json pause
python controller.py --config config.json resume
python controller.py --config config.json resume --source MangaReader.site
python controller.py --config config.json reconcile --output manifest.json
python controller.py --config config.json reconcile --apply --input manifest.json --limit 10
python controller.py --config config.json repair-invariants
python controller.py --config config.json normalize-aliases
python controller.py --config config.json health
```

The daemon runs bounded reconciliation before scheduling and repeats it at the
configured interval. Manual apply mode rechecks each source file before a
move. Replaying the same manifest does not create another active file.

Use `reconcile --apply --quarantine` only for a reviewed manifest. It moves
exact duplicates, different-byte conflicts, invalid archives, and unknown
titles to quarantine. It never deletes them.

`title_aliases` maps changing provider titles to one persistent canonical
library title. Scope sync also clears `selected` on every chapter whose title
has left the configured categories.

The `health` command checks SQLite access and the main-loop heartbeat. Docker
uses it as the container health check. A running process with a stale loop is
unhealthy.

The controller creates one Discord progress dashboard when scheduling starts
and edits that message in place. Set `discord_thread_id` to target an existing
Discord thread; without it, the configured webhook channel is used. The
dashboard updates immediately when the first chapter of a manga is queued, then
refreshes every 15 minutes. It includes a rolling successful chapters/hour rate
and ETA.

MangaFire is blocked. Titles still using it remain visible in `plan` as blocked
until they are migrated to a configured healthy source.

Preview and apply a verified source migration:

```sh
python migration.py --config config.json --old 20 --primary 257 --gap 143
python migration.py --config config.json --old 20 --primary 257 --gap 143 --apply
```

Provider metadata errors can be corrected explicitly during migration. This is
used for One Piece chapter 104, which MangaHere incorrectly labels as 104.5:

```sh
python migration.py --config config.json --old 18 --primary 226 \
  --alias 47048=104 --exclude-chapter 47649 --apply
```

An individual entry on an otherwise healthy source can be replaced after its
chapter downloads are confirmed broken without blocking that source globally:

```sh
python migration.py --config config.json --old 46 --primary 583 \
  --replace-unhealthy --apply
```

Migration apply refuses any coverage gap. Verified non-content records such as
hiatus notices can be excluded explicitly by their old chapter IDs with
`--exclude-old-chapter`.
