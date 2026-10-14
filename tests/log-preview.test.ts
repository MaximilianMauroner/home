import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import LogPreview from "../src/components/content/LogPreview";
import type { PreviewEntry } from "../src/components/content/previewTypes";

const log: PreviewEntry = {
  id: "2026/42",
  data: {
    title: "An entry",
    description: "About it",
    tags: ["ai"],
    image: "/src/assets/log/covers/2026-42.webp",
    releaseDate: "2026-10-14T00:00:00.000Z",
  },
};

const render = (entry: PreviewEntry) =>
  renderToStaticMarkup(createElement(LogPreview, { log: entry }));

describe("dev-log preview", () => {
  test("shows a cover only when the homepage resolved one", () => {
    const markup = render({ ...log, _imageUrl: "/_astro/cover.webp" });
    expect(markup).toContain('class="log-preview log-preview--cover"');
    expect(markup).toContain('src="/_astro/cover.webp"');
  });

  test("keeps archive rows text-only even when the entry has an image", () => {
    const markup = render(log);
    expect(markup).not.toContain("log-preview--cover");
    expect(markup).not.toContain("<img");
  });
});
