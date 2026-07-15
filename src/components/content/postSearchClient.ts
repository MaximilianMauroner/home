import MiniSearch from "minisearch";

import {
  aggregatePostSearchResults,
  POST_SEARCH_INDEX_URL,
  POST_SEARCH_OPTIONS,
  type PostSearchDocument,
  type PostSearchMatch,
  type StoredPostSearchResult,
} from "@/utils/postSearch";

export type PostSearch = (query: string) => PostSearchMatch[];

let searchPromise: Promise<PostSearch> | null = null;

const loadPostSearch = async (): Promise<PostSearch> => {
  const response = await fetch(POST_SEARCH_INDEX_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Search index request failed (${response.status}).`);
  }

  const serializedIndex = await response.text();
  const index = MiniSearch.loadJSON<PostSearchDocument>(
    serializedIndex,
    POST_SEARCH_OPTIONS,
  );

  return (query) =>
    aggregatePostSearchResults(
      index.search(query) as StoredPostSearchResult[],
      query,
    );
};

export const getPostSearch = () => {
  searchPromise ??= loadPostSearch();
  return searchPromise;
};
