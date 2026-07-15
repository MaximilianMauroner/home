import type { Options, SearchResult } from "minisearch";

export const POST_SEARCH_INDEX_URL = "/search-index.json";

export type PostSearchDocument = {
  body: string;
  description: string;
  heading: string;
  id: string;
  postKey: string;
  releaseDate: string;
  tagsText: string;
  title: string;
  url: string;
};

export type StoredPostSearchResult = SearchResult &
  Pick<PostSearchDocument, "body" | "heading" | "postKey" | "releaseDate">;

export type PostSearchMatch = {
  excerpt: string;
  heading: string;
  postKey: string;
  score: number;
};

export const POST_SEARCH_OPTIONS: Options<PostSearchDocument> = {
  fields: ["title", "description", "tagsText", "heading", "body", "url"],
  idField: "id",
  storeFields: ["body", "heading", "postKey", "releaseDate"],
  searchOptions: {
    boost: {
      body: 1,
      description: 3,
      heading: 3,
      tagsText: 6,
      title: 8,
      url: 4,
    },
    combineWith: "AND",
    fuzzy: 0.2,
    prefix: true,
  },
};

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const excerptBoundary = (value: string, index: number, direction: -1 | 1) => {
  let cursor = index;
  while (cursor > 0 && cursor < value.length && !/\s/.test(value[cursor])) {
    cursor += direction;
  }
  return cursor;
};

export const createSearchExcerpt = (
  body: string,
  query: string,
  limit = 190,
) => {
  const text = normalizeWhitespace(body);
  if (text.length <= limit) return text;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1);
  const lowerText = text.toLowerCase();
  const matchIndex = terms.reduce((earliest, term) => {
    const index = lowerText.indexOf(term);
    return index >= 0 ? Math.min(earliest, index) : earliest;
  }, Number.POSITIVE_INFINITY);
  const center = Number.isFinite(matchIndex) ? matchIndex : 0;
  const roughStart = Math.max(0, center - Math.floor(limit * 0.3));
  const start = excerptBoundary(text, roughStart, -1);
  const roughEnd = Math.min(text.length, start + limit);
  const end = excerptBoundary(text, roughEnd, 1);

  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
};

export const aggregatePostSearchResults = (
  results: StoredPostSearchResult[],
  query: string,
) => {
  const matches = new Map<string, PostSearchMatch>();

  for (const result of results) {
    if (matches.has(result.postKey)) continue;
    matches.set(result.postKey, {
      excerpt: createSearchExcerpt(result.body, query),
      heading: result.heading,
      postKey: result.postKey,
      score: result.score,
    });
  }

  return [...matches.values()];
};
