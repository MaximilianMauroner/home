import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reads robots and article:modified_time from <meta> tags in rendered HTML.
 * @param {string} html
 * @returns {{ indexable: boolean, modifiedAt?: string }}
 */
export function parsePageMetadata(html) {
  const meta = new Map();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map(([, key, value]) => [
        key.toLowerCase(),
        value,
      ]),
    );
    const key = attributes.name ?? attributes.property;
    if (key && attributes.content !== undefined && !meta.has(key)) {
      meta.set(key, attributes.content);
    }
  }
  const robots = meta.get("robots") ?? "";
  return {
    indexable: !/\bnoindex\b/i.test(robots),
    modifiedAt: meta.get("article:modified_time"),
  };
}

/**
 * Lets the sitemap follow each prerendered page's own metadata, so sitemap
 * membership and lastmod cannot drift from what the page itself declares.
 * Add `integration` before `sitemap()` so its build hook runs first.
 */
export function createSitemapPageMetadata() {
  /** @type {Map<string, { indexable: boolean, modifiedAt?: string }> | undefined} */
  let pagesByPath;

  const lookup = (url) => {
    if (!pagesByPath) {
      throw new Error(
        "sitemap-page-metadata must run before @astrojs/sitemap in integrations.",
      );
    }
    return pagesByPath.get(new URL(url).pathname);
  };

  return {
    integration: {
      name: "sitemap-page-metadata",
      hooks: {
        "astro:build:done": async ({ dir, pages }) => {
          pagesByPath = new Map(
            await Promise.all(
              pages.map(async ({ pathname }) => {
                const path = `/${pathname}`.replace(/\/?$/, "/");
                const html = await readFile(
                  join(fileURLToPath(dir), path, "index.html"),
                  "utf8",
                ).catch(() => undefined);
                // A listed page without a written file is not served.
                const metadata = html
                  ? parsePageMetadata(html)
                  : { indexable: false };
                // Encode like the sitemap URLs that lookup() receives.
                const key = new URL(path, "https://example.com").pathname;
                return /** @type {const} */ ([key, metadata]);
              }),
            ),
          );
        },
      },
    },
    /** Server-rendered routes have no build output and stay indexable. */
    isIndexable: (url) => lookup(url)?.indexable ?? true,
    lastmodFor: (url) => lookup(url)?.modifiedAt,
  };
}
