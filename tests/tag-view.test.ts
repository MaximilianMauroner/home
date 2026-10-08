import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import TagView from "../src/components/content/TagView";
import type { TaggedPreviewEntry } from "../src/components/content/previewTypes";

test("empty-result recovery broadens the topic while preserving search before hydration", () => {
  const query = "stretching & mobility";
  const posts: TaggedPreviewEntry[] = [
    {
      collection: "blog",
      id: "ai-notes",
      data: {
        title: "AI notes",
        description: "Notes on language models.",
        tags: ["ai"],
        releaseDate: "2026-10-01",
      },
    },
    {
      collection: "log",
      id: "stretching-routine",
      data: {
        title: "Stretching & mobility",
        description: "A daily routine.",
        tags: ["health"],
        releaseDate: "2026-10-02",
      },
    },
  ];
  const tags: Array<[string, number]> = [
    ["ai", 1],
    ["health", 1],
  ];
  const source = new JSDOM(
    renderToStaticMarkup(
      createElement(TagView, {
        posts,
        tags,
        preSelectedTag: "ai",
        initialSearchQuery: query,
      }),
    ),
    {
      url: `https://www.mauroner.net/tags/ai/?${new URLSearchParams({ q: query })}`,
    },
  );
  const emptyState = source.window.document.querySelector(
    ".topic-posts__empty",
  );
  expect(emptyState?.textContent).toContain("No matching posts");
  const recovery = emptyState?.querySelector("a");
  expect(recovery?.textContent).toContain("Browse all topics");
  expect(recovery?.getAttribute("href")).toBe(
    `/tags/?${new URLSearchParams({ q: query })}`,
  );

  // Follow the server-rendered native link without hydrating either page.
  const destinationUrl = new URL(
    recovery?.getAttribute("href") ?? "",
    source.window.location.href,
  );
  expect(destinationUrl.pathname).toBe("/tags/");
  expect(destinationUrl.searchParams.get("q")).toBe(query);
  const destination = new JSDOM(
    renderToStaticMarkup(
      createElement(TagView, {
        posts,
        tags,
        initialSearchQuery: destinationUrl.searchParams.get("q") ?? "",
      }),
    ),
  );
  expect(
    destination.window.document.querySelector<HTMLInputElement>("#tag-search")
      ?.value,
  ).toBe(query);
  expect(
    destination.window.document.querySelector(".topic-posts__empty"),
  ).toBeNull();
  expect(
    [...destination.window.document.querySelectorAll(".topic-post h4 a")].map(
      (link) => link.getAttribute("href"),
    ),
  ).toEqual(["/dev-log/stretching-routine/"]);
  source.window.close();
  destination.window.close();
});
