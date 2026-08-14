# Agent instructions

This repository contains Max's website, blog, development log, and browser-local
tools at `mauroner.net`.

## Source of truth

- Use the assigned task as the source of truth for non-trivial work. If there is
  no task, use the user request and repository documentation.
- Read `README.md`, the relevant content schema, nearby code, tests, and scripts
  before you make a change.
- Keep live status and handoff notes in the task tracker. Keep repository docs
  for durable product and implementation guidance.

## Work rules

- Keep changes narrow. Do not add speculative abstractions or unrelated
  refactors.
- Prefer Astro pages and components. Use React only for interactive islands and
  tools.
- Treat content, metadata, Open Graph output, RSS, accessibility, and route
  changes as user-visible behavior.
- Browser-local tools must avoid unnecessary data collection and external sync.
- Before you start a development server, check for a suitable running server
  and reuse it.
- Use existing Astro, React, Tailwind, and content patterns before you add a new
  pattern.

## Validation

- Run focused tests for the files you change.
- Use `bun run test` for the normal test suite.
- Use `bun run build` when the change affects Astro integration, generated
  routes, or production output.
- Test content links and replace local development URLs with
  production-relative URLs before publication.

## Boundaries

- Do not commit secrets.
- Do not use destructive Git commands.
- Do not change deployment, authentication, billing, or data-loss-sensitive
  behavior without explicit direction.
- Report the changed files, verification, known limits, and next action in the
  final handoff.
