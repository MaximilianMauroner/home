# Agent Instructions

Repo-wide rules.

## Source

* Use the homepage task tracker as the source of truth for non-trivial issues,
  roadmap tracking, milestones, dependencies, estimates, owners, and task
  status.
* No tracked task = user request + repo docs.
* Read first: `README.md`, content schemas, nearby code, tests, and scripts.
* Keep repo docs for durable product context and sequencing guardrails, not as
  the live issue tracker or milestone board.

## Task-Tracking Workflow

Use this exact state machine for sections or a single-select `Stage` custom
field:

* `Inbox / Idea Captured`
* `Spec / Clarification`
* `Ready for Slicing`
* `Ready for Agent`
* `In Progress`
* `Agent Self-Review`
* `Human Review`
* `Changes Requested`
* `Ready to Merge`
* `Merged / Closed`
* `Blocked on Human`
* `Blocked on Dependency`

Do not use vague state names: `Ready`, `Review`, `Done`, `Waiting`, `Agent`.

Required fields for non-trivial work:

* `Stage`
* `Risk`: `Low`, `Medium`, or `High`
* `Mode`: `AFK` or `HITL`
* `Parent idea/report`
* `Repo`
* `Branch`
* `PR`
* `Acceptance criteria present`: `Yes` or `No`
* `Test instructions present`: `Yes` or `No`
* `Human approval`: `Pending`, `Approved`, `Changes requested`, or `Rejected`
* `Merge policy`: `Agent may merge` or `Human must merge`

Create the parent task as soon as a non-trivial idea becomes real. The parent
task holds the report/spec, business context, links, glossary decisions, ADR
links, decisions, assumptions, open questions, and final outcome.

Implementation work must be separate top-level vertical-slice tasks linked to
the parent. Use subtasks only when task-tracker tooling reliably keeps them visible in
the project views that matter.

Use real tracker dependencies when tooling supports them. Do not rely only on
`Blocked by` prose.

## Definition Of Ready

`Ready for Agent` is impossible unless all of these are true:

* Problem statement is clear.
* User-visible behavior is defined.
* Acceptance criteria are testable.
* Out of scope is listed.
* Dependencies are linked or explicitly absent.
* Risk level is set.
* HITL vs AFK mode is set.
* Test expectations are listed.
* Unresolved-question status is documented.
* Merge policy is set.

Each implementation task must include:

```markdown
## Definition of Ready

- [ ] Problem statement is clear
- [ ] User-visible behavior is defined
- [ ] Acceptance criteria are testable
- [ ] Out of scope is listed
- [ ] Dependencies are linked
- [ ] Risk level is set: Low / Medium / High
- [ ] HITL vs AFK is set
- [ ] Test expectations are listed

## Implementation artifacts required

- PR link
- Branch name
- Test evidence
- Manual testing instructions
- Known risks / limitations
- Subagent review summaries
- Follow-up tasks created, if needed

## Merge policy

This task may be merged only when:
- Human review is approved
- Required CI checks pass
- No blocking review findings remain
- Main branch target is confirmed
```

Keep HITL and AFK loops separate. Decision comments contain questions,
recommendations, and why the answer matters. Implementation comments contain
progress, assumptions, verification, blockers, and handoff.

## Review And Handoff

Agent handoff comments must use this format:

```markdown
## TL;DR

One paragraph on what changed and why.

## PR

<PR link>

## What changed

- User-visible change
- Internal change
- Data/model/API change, if any

## How to test manually

1. Step one
2. Step two
3. Expected result

## Automated test evidence

- Unit:
- Integration:
- E2E:
- Typecheck/lint:
- CI:

## Subagent reviews

- Reviewer A:
- Reviewer B:
- Blocking findings:
- Non-blocking findings:

## Known risks

- Risk:
- Mitigation:

## Merge readiness

- [ ] Acceptance criteria satisfied
- [ ] CI green
- [ ] Human approval needed
- [ ] No unresolved P0/P1 questions
```

Human review responses should be recorded as:

```markdown
## Review result

Approved / Changes requested / Rejected

## Tested

- What I tested:
- Environment:
- Result:

## Findings

- Blocking:
- Non-blocking:

## Merge decision

Ready to merge / Not ready to merge
```

Merge comments must be mechanical:

```markdown
## Merged

- PR:
- Main commit:
- CI after merge:
- Follow-up tasks:
- Closed because:
```

Product acceptance and technical mergeability are separate gates. A task can be
product-approved but not mergeable, or mergeable but not product-accepted. Move
to `Ready to Merge` only when both gates pass.

High-risk work requires `Human must merge`: migrations, auth, billing, data
deletion, security-sensitive code, and irreversible production changes. For
high-risk work, require a second human review or a second independent model/code
review pass before merge.

## Implementation Workflow

* Use subagents when they can materially speed up independent exploration,
  implementation, or review. Keep ownership and write scopes explicit.
* Scope to issue/request; make the smallest clean change.
* No unrelated refactors, speculative abstractions, or unrequested flexibility.
* Ambiguous implementation detail: make the smallest reasonable assumption and
  record it in the task tracker. Ask only when choices change implementation materially.
* Before starting a dev server, check whether a suitable server is already
  running and reuse it.

## Commands

* Package manager/runtime: Bun.
* Common checks: `bun run test`.
* `bun run build` performs Astro checks and production build; run it only when
  the task warrants a full build or the user asks.

## Product Constraints

* This is the personal website and tools hub for `mauroner.net`.
* Prefer Astro-first pages and React only for interactive islands/tools.
* Content, metadata, OG output, RSS, and accessibility changes are
  user-visible. Treat them as product behavior with testable acceptance
  criteria.
* Browser-local tools must avoid unnecessary data collection or external sync.

## Styling

* Use existing Astro, React, Tailwind, and content patterns first.
* Prefer restrained UI changes that preserve readability, performance, and
  accessibility.

## Boundaries

* No secrets.
* No destructive git commands.
* No CI/deployment/auth/billing/data-loss-sensitive changes without explicit
  direction.
* Final handoff: changed, verification, known limits, task status/next step.
