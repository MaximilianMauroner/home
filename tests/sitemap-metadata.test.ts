import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, test } from "vitest";

import { getGitModifiedDate } from "../plugins/git-modified-date.mjs";
import {
  createSitemapPageMetadata,
  parsePageMetadata,
} from "../plugins/sitemap-page-metadata.mjs";
import { getArticleDates } from "../src/utils/server/articleDates";
import { serializeJsonLd } from "../src/utils/server/seo";

const tempDirs: string[] = [];
const makeTempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "sitemap-metadata-"));
  tempDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const page = (robots: string, modifiedAt?: string) =>
  `<html lang="en"><meta charset="utf-8"><meta name="robots" content="${robots}">${
    modifiedAt
      ? `<meta property="article:modified_time" content="${modifiedAt}">`
      : ""
  }<body></body></html>`;

describe("parsePageMetadata", () => {
  test("reads robots and article modification time", () => {
    expect(
      parsePageMetadata(page("index, follow", "2026-09-19T21:08:46.000Z")),
    ).toEqual({ indexable: true, modifiedAt: "2026-09-19T21:08:46.000Z" });
    expect(parsePageMetadata(page("noindex, follow"))).toEqual({
      indexable: false,
      modifiedAt: undefined,
    });
  });

  test("accepts attributes in any order", () => {
    expect(
      parsePageMetadata('<meta content="NOINDEX" name="robots" />').indexable,
    ).toBe(false);
  });
});

describe("createSitemapPageMetadata", () => {
  const writePage = (root: string, path: string, html: string) => {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, "index.html"), html);
  };

  test("follows each built page's own robots and modified metadata", async () => {
    const root = makeTempDir();
    writePage(root, "", page("index, follow"));
    writePage(root, "tags/ai", page("index, follow"));
    writePage(root, "tags/qwik", page("noindex, follow"));
    writePage(root, "tags/two words", page("noindex, follow"));
    writePage(
      root,
      "blog/post",
      page("index, follow", "2026-10-06T21:55:21.000Z"),
    );

    const metadata = createSitemapPageMetadata();
    await metadata.integration.hooks["astro:build:done"]({
      dir: pathToFileURL(`${root}/`),
      pages: [
        "",
        "tags/ai/",
        "tags/qwik/",
        "tags/two words/",
        "blog/post/",
        "gone/",
      ].map((pathname) => ({ pathname })),
    });

    const site = "https://www.mauroner.net";
    expect(metadata.isIndexable(`${site}/`)).toBe(true);
    expect(metadata.isIndexable(`${site}/tags/ai/`)).toBe(true);
    expect(metadata.isIndexable(`${site}/tags/qwik/`)).toBe(false);
    // Sitemap URLs arrive percent-encoded.
    expect(metadata.isIndexable(`${site}/tags/two%20words/`)).toBe(false);
    // Listed but never written, so never served.
    expect(metadata.isIndexable(`${site}/gone/`)).toBe(false);
    // Server-rendered routes have no build output.
    expect(metadata.isIndexable(`${site}/tags/`)).toBe(true);

    expect(metadata.lastmodFor(`${site}/blog/post/`)).toBe(
      "2026-10-06T21:55:21.000Z",
    );
    expect(metadata.lastmodFor(`${site}/tags/ai/`)).toBeUndefined();
  });

  test("fails instead of admitting every page when the hook did not run", () => {
    const metadata = createSitemapPageMetadata();
    expect(() => metadata.isIndexable("https://www.mauroner.net/")).toThrow(
      /before @astrojs\/sitemap/,
    );
  });
});

describe("getGitModifiedDate", () => {
  const git = (cwd: string, args: string[], date?: string) =>
    execFileSync("git", args, {
      cwd,
      stdio: "pipe",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.com",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.com",
        ...(date && { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }),
      },
    });
  const commit = (cwd: string, file: string, date: string) => {
    writeFileSync(join(cwd, file), date);
    git(cwd, ["add", file]);
    git(cwd, ["commit", "-q", "-m", file], date);
  };

  test("uses real history and omits dates hidden by a shallow clone", () => {
    const origin = makeTempDir();
    git(origin, ["init", "-q"]);
    commit(origin, "old.md", "2024-01-01T10:00:00Z");
    commit(origin, "boundary.md", "2025-01-01T10:00:00Z");
    commit(origin, "new.md", "2026-01-01T10:00:00Z");

    expect(Date.parse(getGitModifiedDate(join(origin, "old.md")) ?? "")).toBe(
      Date.parse("2024-01-01T10:00:00Z"),
    );

    const clone = join(makeTempDir(), "clone");
    git(origin, [
      "clone",
      "-q",
      "--depth",
      "2",
      pathToFileURL(origin).href,
      clone,
    ]);

    expect(Date.parse(getGitModifiedDate(join(clone, "new.md")) ?? "")).toBe(
      Date.parse("2026-01-01T10:00:00Z"),
    );
    // The boundary commit appears to add old.md, which would be a false date.
    expect(getGitModifiedDate(join(clone, "old.md"))).toBeUndefined();
    expect(getGitModifiedDate(join(clone, "untracked.md"))).toBeUndefined();

    // Linked worktrees keep the shallow boundary in the common repository,
    // rather than in their own worktree-specific git directory.
    const worktree = join(makeTempDir(), "worktree");
    git(clone, ["worktree", "add", "-q", "--detach", worktree]);
    expect(Date.parse(getGitModifiedDate(join(worktree, "new.md")) ?? "")).toBe(
      Date.parse("2026-01-01T10:00:00Z"),
    );
    expect(getGitModifiedDate(join(worktree, "old.md"))).toBeUndefined();
  });
});

describe("getArticleDates", () => {
  test("never reports a modification before publication", () => {
    expect(
      getArticleDates(new Date("2026-01-10"), "2026-01-07T15:11:50+01:00"),
    ).toEqual({
      publishedAt: "2026-01-10T00:00:00.000Z",
      modifiedAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-01-10T00:00:00.000Z",
    });
  });

  test("omits an unknown modification but keeps the visible fallback", () => {
    expect(getArticleDates("2025-03-28")).toEqual({
      publishedAt: "2025-03-28T00:00:00.000Z",
      modifiedAt: undefined,
      updatedAt: "2025-03-28T00:00:00.000Z",
    });
  });
});

test("serializeJsonLd cannot close the surrounding script element", () => {
  const json = serializeJsonLd({ headline: "</script><script>alert(1)" });
  expect(json).not.toContain("</script");
  expect(JSON.parse(json).headline).toBe("</script><script>alert(1)");
});
