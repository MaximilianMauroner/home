import MiniSearch from "minisearch";
import { describe, expect, test } from "vitest";

import {
  aggregatePostSearchResults,
  POST_SEARCH_OPTIONS,
  type PostSearchDocument,
  type StoredPostSearchResult,
} from "../src/utils/postSearch";
import {
  buildPostSearchDocuments,
  extractSearchSections,
  serializePostSearchIndex,
} from "../src/utils/searchIndex";

const source = {
  body: `
import Hero from "./Hero.astro"

Introductory prose about transparent rankings.

## Rating uncertainty

Uncertainty pulls extreme predictions back toward fifty percent.

<Hero label="presentation only" />
`,
  collection: "blog" as const,
  description: "How the ranking model works.",
  id: "ranking-model",
  releaseDate: new Date("2026-07-13T00:00:00.000Z"),
  tags: ["esports", "power-rankings"],
  title: "A transparent power index",
  url: "/blog/ranking-model/",
};

describe("post search indexing", () => {
  test("extracts headings and body text without MDX imports or component props", () => {
    const sections = extractSearchSections(source.body);

    expect(sections).toEqual([
      { heading: "", text: "Introductory prose about transparent rankings." },
      {
        heading: "Rating uncertainty",
        text: "Uncertainty pulls extreme predictions back toward fifty percent.",
      },
    ]);
    expect(JSON.stringify(sections)).not.toContain("presentation only");
    expect(JSON.stringify(sections)).not.toContain("Hero.astro");
  });

  test("finds terms that exist only in a heading or body", () => {
    const documents = buildPostSearchDocuments([source]);
    const index = new MiniSearch<PostSearchDocument>(POST_SEARCH_OPTIONS);
    index.addAll(documents);

    const headingResults = aggregatePostSearchResults(
      index.search("uncertainty") as StoredPostSearchResult[],
      "uncertainty",
    );
    const bodyResults = aggregatePostSearchResults(
      index.search("predictions") as StoredPostSearchResult[],
      "predictions",
    );

    expect(headingResults[0]?.postKey).toBe("blog:ranking-model");
    expect(bodyResults[0]?.excerpt).toContain("predictions");
  });

  test("ranks title matches above body-only matches and aggregates sections", () => {
    const documents = buildPostSearchDocuments([
      source,
      {
        ...source,
        body: "A passing reference to a transparent power index.",
        id: "body-only",
        title: "Other notes",
        url: "/blog/body-only/",
      },
    ]);
    const index = new MiniSearch<PostSearchDocument>(POST_SEARCH_OPTIONS);
    index.addAll(documents);
    const results = aggregatePostSearchResults(
      index.search("transparent power index") as StoredPostSearchResult[],
      "transparent power index",
    );

    expect(results.map(({ postKey }) => postKey)).toEqual([
      "blog:ranking-model",
      "blog:body-only",
    ]);
    expect(
      results.filter(({ postKey }) => postKey === "blog:ranking-model"),
    ).toHaveLength(1);
  });

  test("requires every term in a multi-word query", () => {
    const documents = buildPostSearchDocuments([source]);
    const index = new MiniSearch<PostSearchDocument>(POST_SEARCH_OPTIONS);
    index.addAll(documents);

    expect(index.search("uncertainty predictions")).not.toHaveLength(0);
    expect(index.search("uncertainty unrelated")).toHaveLength(0);
  });

  test("tolerates a small typo in a long search term", () => {
    const documents = buildPostSearchDocuments([source]);
    const index = new MiniSearch<PostSearchDocument>(POST_SEARCH_OPTIONS);
    index.addAll(documents);

    expect(index.search("uncertanty")[0]?.postKey).toBe("blog:ranking-model");
  });

  test("serializes an index that can be restored in the browser", () => {
    const documents = buildPostSearchDocuments([source]);
    const serialized = serializePostSearchIndex(documents);
    const index = MiniSearch.loadJSON<PostSearchDocument>(
      serialized,
      POST_SEARCH_OPTIONS,
    );

    expect(index.search("fifty")[0]?.postKey).toBe("blog:ranking-model");
  });
});
