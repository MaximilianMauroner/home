---
name: verify-home
description: Verify Home content routes and browser-local tools. Use when checking changed content or tool journeys with disposable fixtures.
---

# Verify Home

Read AGENTS.md, README.md, content schemas, toolCatalog.ts and [features.md](features.md).
Use an isolated worktree and distinct test origin. Check active servers but do not
share another repository's instance. Check memory, load and owned port first.
Select only journeys affected by product work in the requested window.
Record revision, Node/runtime versions and fixture identity. package.json specifies
Node 22 and pnpm 9.15.5; install with `pnpm install --frozen-lockfile`.
Start `pnpm dev --host 0.0.0.0 --port 43136` on an owned network. Astro 7 runs
a managed background server in agent sessions. Retain its printed PID and inspect
`.astro/dev.log` if startup fails. An IP-only bind can leave its local URL unset.
Require HTTP home and tools routes to return successfully. Establish the native
T3 browser's reachable address with status/open/navigate before mutations.
A local HTTP response does not prove browser reachability. Investigate readiness
before one targeted retry when navigation or a product action fails.

Run rows serially. Select Photo Journey’s Offline map mode before playback/export in an audit
without external tile access. Block external browser requests in that owned
context when the default Terrain mode could fetch tiles. Use tests/fixtures for photos and fabricated uploads for chat,
music and data analysis. Use a fresh origin/profile so IndexedDB/localStorage
cannot contain personal data. Account-backed tools need disposable authorized
accounts and credential names from their current source. Never send external
messages, write provider playlists, or run CMS writes in a read-only audit.
Wait for each AI acceptability answer to commit before the next action; the
public UI has a 650 ms pending-answer interval. Spotify accepts an Extended
Streaming History ZIP with Audio JSON entries, not a raw JSON upload. Confirm
client hydration before upload and inspect the parsed count after import.
Supporting checks: `bun run test`; `bun run build` when generated output is selected.

Stop the managed server with `pnpm astro dev stop` from this worktree and
confirm its recorded PID/port are gone; remove only run-created browser storage, uploads and downloads.
Revoke only run-granted device permissions. Retain redacted results privately.
No source content, deployment or normal browser data is changed. Missing account,
device or native browser access blocks the relevant row, not its expected result.
