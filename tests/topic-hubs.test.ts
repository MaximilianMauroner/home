import { JSDOM } from "jsdom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import TagView from "../src/components/content/TagView";
import type { TaggedPreviewEntry } from "../src/components/content/previewTypes";
import { getTopicHub } from "../src/utils/topicHubs";

const post = (
  collection: TaggedPreviewEntry["collection"],
  id: string,
  title: string,
  tags: string[],
  releaseDate: string,
): TaggedPreviewEntry => ({
  collection,
  id,
  data: { title, description: `${title} description.`, tags, releaseDate },
});

const obsidianPosts = [
  post(
    "blog",
    "000-obsidian-as-a-cms",
    "Obsidian as a CMS",
    ["obsidian"],
    "2024-12-11",
  ),
  post("log", "2025/01", "Diary templates", ["obsidian"], "2025-01-05"),
  post(
    "snacks",
    "000-notion-obsidian-port",
    "Notion export",
    ["obsidian", "notion"],
    "2025-11-04",
  ),
];

const render = (props: Parameters<typeof TagView>[0]) =>
  new JSDOM(renderToStaticMarkup(createElement(TagView, props))).window
    .document;

test("only curated topics resolve to a hub", () => {
  expect(getTopicHub("notion", obsidianPosts)).toBeUndefined();
  expect(
    getTopicHub("obsidian", obsidianPosts)?.startHere.map((entry) => entry.id),
  ).toEqual(["000-obsidian-as-a-cms", "2025/01", "000-notion-obsidian-port"]);
});

test("a hub fails loudly when a listed post is missing or untagged", () => {
  expect(() => getTopicHub("obsidian", obsidianPosts.slice(1))).toThrow(
    /blog:000-obsidian-as-a-cms/,
  );
});

test("start-here links render in reading order without changing chronological browsing", () => {
  const hub = getTopicHub("obsidian", obsidianPosts);
  const document = render({
    posts: obsidianPosts,
    tags: [["obsidian", 3]],
    preSelectedTag: "obsidian",
    startHere: hub?.startHere,
  });

  expect(
    [...document.querySelectorAll(".topic-atlas__start a")].map((link) =>
      link.getAttribute("href"),
    ),
  ).toEqual([
    "/blog/000-obsidian-as-a-cms/",
    "/dev-log/2025/01/",
    "/snacks/000-notion-obsidian-port/",
  ]);
  expect(
    [...document.querySelectorAll(".topic-post h4 a")].map((link) =>
      link.getAttribute("href"),
    ),
  ).toEqual([
    "/snacks/000-notion-obsidian-port/",
    "/dev-log/2025/01/",
    "/blog/000-obsidian-as-a-cms/",
  ]);
});

test("an active search hides the start-here path and keeps search results first", () => {
  const document = render({
    posts: obsidianPosts,
    tags: [["obsidian", 3]],
    preSelectedTag: "obsidian",
    initialSearchQuery: "diary",
    startHere: getTopicHub("obsidian", obsidianPosts)?.startHere,
  });

  expect(document.querySelector(".topic-atlas__start")).toBeNull();
  expect(document.querySelector(".topic-posts__header h3")?.textContent).toBe(
    "Search results",
  );
  expect(
    [...document.querySelectorAll(".topic-post h4 a")].map((link) =>
      link.getAttribute("href"),
    ),
  ).toEqual(["/dev-log/2025/01/"]);
});
