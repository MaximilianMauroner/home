import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { preprocessCSS, resolveConfig } from "vite";
import { describe, expect, test } from "vitest";

// Astro's Tailwind integration registers one plugin instance for every
// stylesheet. Tailwind 3 keeps the last `@config` path on that instance, so
// each entry must name its own config or it inherits the previous entry's scan.
const globalsPath = resolve("src/styles/globals.css");
const homepagePath = resolve("src/styles/homepage.css");

const compileEntries = async (homepageFirst: boolean) => {
  const config = await resolveConfig(
    {
      configFile: false,
      logLevel: "silent",
      css: { postcss: "tests/fixtures/stylesheet-entries" },
    },
    "build",
  );
  const compile = async (file: string) =>
    (await preprocessCSS(readFileSync(file, "utf8"), file, config)).code;

  if (homepageFirst) {
    const homepage = await compile(homepagePath);
    return { homepage, globals: await compile(globalsPath) };
  }
  const globals = await compile(globalsPath);
  return { globals, homepage: await compile(homepagePath) };
};

// `inset-y-0` is used by site pages and tools, but not by homepage sources.
const siteOnlyUtility = ".inset-y-0";

describe("stylesheet entries", () => {
  test.each([
    // Tailwind caches contexts per process, so the clean order runs first.
    ["globals first", false],
    ["homepage first", true],
  ])(
    "keep their own Tailwind content scan (%s)",
    async (_, homepageFirst) => {
      const css = await compileEntries(homepageFirst);

      expect(css.globals).toContain(siteOnlyUtility);
      expect(css.homepage).not.toContain(siteOnlyUtility);
      expect(css.homepage.length).toBeLessThan(css.globals.length / 2);
      for (const shared of [
        "@font-face",
        "--muted-foreground",
        "@keyframes terminal-cursor",
      ]) {
        expect(css.globals).toContain(shared);
        expect(css.homepage).toContain(shared);
      }
    },
    60_000,
  );
});
