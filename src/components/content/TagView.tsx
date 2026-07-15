import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import BlogPreview from "./BlogPreview";
import LogPreview from "./LogPreview";
import SnackPreview from "./SnackPreview";
import type { TaggedPreviewEntry } from "./previewTypes";
import type { PostSearch } from "./postSearchClient";
import type { PostSearchMatch } from "@/utils/postSearch";

type TagViewProps = {
  posts: TaggedPreviewEntry[];
  tags: Array<[string, number]>;
  preSelectedTag?: string;
  initialSearchQuery?: string;
};

const searchQueryInPost = (search: string, post: TaggedPreviewEntry) => {
  if (!search.trim()) return true;

  const searchLower = search.toLowerCase();
  return (
    post.data.title.toLowerCase().includes(searchLower) ||
    post.data.description.toLowerCase().includes(searchLower) ||
    post.data.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
    post.id.toLowerCase().includes(searchLower)
  );
};

const postKeyFor = (post: TaggedPreviewEntry) =>
  `${post.collection}:${post.id}`;

type SearchIndexStatus = "idle" | "loading" | "ready" | "fallback";

export default function TagView({
  posts,
  tags,
  preSelectedTag,
  initialSearchQuery = "",
}: TagViewProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(
    preSelectedTag ?? null,
  );

  // Read search from URL on client side to ensure it's correct after hydration
  const [search, setSearch] = useState(initialSearchQuery);
  const deferredSearch = useDeferredValue(search.trim());
  const [searchIndexStatus, setSearchIndexStatus] =
    useState<SearchIndexStatus>("idle");
  const [fullTextResults, setFullTextResults] = useState<{
    matches: PostSearchMatch[];
    query: string;
  }>({ matches: [], query: "" });
  const postSearchRef = useRef<PostSearch | null>(null);
  const searchRequestRef = useRef(0);
  const isInitialMount = useRef(true);

  // Ensure search is synced with URL on mount (in case of hydration mismatch)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSearch = urlParams.get("q") || "";
      if (urlSearch !== search) {
        setSearch(urlSearch);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSearchIndex = useCallback(async () => {
    if (postSearchRef.current) return postSearchRef.current;

    setSearchIndexStatus("loading");
    try {
      const { getPostSearch } = await import("./postSearchClient");
      const postSearch = await getPostSearch();
      postSearchRef.current = postSearch;
      setSearchIndexStatus("ready");
      return postSearch;
    } catch {
      setSearchIndexStatus("fallback");
      return null;
    }
  }, []);

  useEffect(() => {
    if (!deferredSearch) {
      setFullTextResults({ matches: [], query: "" });
      return;
    }

    const request = ++searchRequestRef.current;
    void loadSearchIndex().then((postSearch) => {
      if (!postSearch || request !== searchRequestRef.current) return;
      setFullTextResults({
        matches: postSearch(deferredSearch),
        query: deferredSearch,
      });
    });
  }, [deferredSearch, loadSearchIndex]);

  const hasCurrentFullTextResults =
    fullTextResults.query === deferredSearch && searchIndexStatus === "ready";
  const matchByPostKey = useMemo(
    () =>
      new Map(
        hasCurrentFullTextResults
          ? fullTextResults.matches.map((match) => [match.postKey, match])
          : [],
      ),
    [fullTextResults.matches, hasCurrentFullTextResults],
  );

  const selectedPosts = useMemo(() => {
    const tagFilteredPosts = posts.filter((post) =>
      selectedTag ? post.data.tags.includes(selectedTag) : true,
    );

    if (!deferredSearch) return tagFilteredPosts;

    if (hasCurrentFullTextResults) {
      const postsByKey = new Map(
        tagFilteredPosts.map((post) => [postKeyFor(post), post]),
      );
      return fullTextResults.matches.flatMap((match) => {
        const post = postsByKey.get(match.postKey);
        return post ? [post] : [];
      });
    }

    return tagFilteredPosts.filter((post) =>
      searchQueryInPost(deferredSearch, post),
    );
  }, [
    deferredSearch,
    fullTextResults.matches,
    hasCurrentFullTextResults,
    posts,
    selectedTag,
  ]);

  const activePostCount = selectedPosts.length;
  const totalPostCount = posts.length;
  const clearSearch = () => {
    setSearch("");
    requestAnimationFrame(() => document.getElementById("tag-search")?.focus());
  };

  // Update URL when search changes (but don't add to history stack)
  useEffect(() => {
    // Skip URL update on initial mount to avoid redirect issues
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const url = new URL(window.location.href);
    if (search) {
      url.searchParams.set("q", search);
    } else {
      url.searchParams.delete("q");
    }
    window.history.replaceState({}, "", url.toString());
  }, [search]);

  return (
    <>
      <div className="sticky top-[4.5rem] z-30 bg-background/95 p-4 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
        <Search
          search={search}
          searchIndexStatus={searchIndexStatus}
          setSearch={setSearch}
          onSearchIntent={() => void loadSearchIndex()}
        />
      </div>
      <div className="grid grid-cols-6 gap-4 px-4 pb-4">
        <div className="col-span-6 md:col-span-2">
          <TagList
            tags={tags}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
          />
        </div>
        <div className="col-span-6 md:col-span-4">
          <PostList
            posts={selectedPosts}
            activePostCount={activePostCount}
            totalPostCount={totalPostCount}
            search={search}
            selectedTag={selectedTag}
            onClearSearch={clearSearch}
            matchByPostKey={matchByPostKey}
            preserveOrder={hasCurrentFullTextResults && Boolean(deferredSearch)}
          />
        </div>
      </div>
    </>
  );
}

const TagList = ({
  tags,
  selectedTag,
  setSelectedTag,
}: {
  tags: Array<[string, number]>;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="sticky top-28">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold">Tags:</h2>
          <span className="font-mono text-2xl text-muted-foreground">
            ({tags.length})
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label={isExpanded ? "Collapse tag list" : "Expand tag list"}
          aria-expanded={isExpanded}
          aria-controls="tag-list"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className={
              "size-4 transition-transform " + (isExpanded ? "rotate-180" : "")
            }
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>
      </div>
      <ul
        id="tag-list"
        className="flex flex-wrap gap-2 sm:gap-6 md:gap-3 lg:gap-4"
        aria-label="All tags with blog post counts"
      >
        {tags
          .sort((a, b) => {
            return a[0].localeCompare(b[0]);
          })
          .map(([tagName, count]) => (
            <li
              key={tagName}
              className={
                isExpanded || tagName === selectedTag
                  ? ""
                  : "hidden lg:list-item"
              }
            >
              <button
                type="button"
                aria-pressed={selectedTag === tagName}
                onClick={() => {
                  if (selectedTag === tagName) {
                    setSelectedTag(null);
                    window.location.href = "/tags/";
                  } else {
                    setSelectedTag(tagName);
                    window.location.href = `/tags/${tagName}/`;
                  }
                }}
                className={
                  "relative inline-flex min-h-11 w-fit items-center whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold text-foreground md:min-h-0 md:px-2.5 md:py-0.5" +
                  (selectedTag === tagName
                    ? " outline-none ring-2 ring-ring"
                    : "")
                }
              >
                <span>{tagName}</span>
                <span className="pl-1 text-sm text-muted-foreground">
                  {count}
                </span>
                {selectedTag === tagName && (
                  <span className="absolute right-0 top-0 -translate-y-[50%] translate-x-[50%] rounded-full bg-black text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="size-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                  </span>
                )}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

const PostList = ({
  posts,
  activePostCount,
  totalPostCount,
  search,
  selectedTag,
  onClearSearch,
  matchByPostKey,
  preserveOrder,
}: {
  posts: TaggedPreviewEntry[];
  activePostCount: number;
  totalPostCount: number;
  search: string;
  selectedTag: string | null;
  onClearSearch: () => void;
  matchByPostKey: Map<string, PostSearchMatch>;
  preserveOrder: boolean;
}) => {
  const items = [...posts];
  if (!preserveOrder) {
    items.sort((a, b) => {
      return (
        new Date(b.data.releaseDate).getTime() -
        new Date(a.data.releaseDate).getTime()
      );
    });
  }
  return (
    <>
      <div className="mb-4 flex justify-between gap-2">
        <div className="flex items-center">
          <h2 className="text-2xl font-bold">Posts:</h2>
          <span
            className="font-mono text-2xl text-muted-foreground"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            ({activePostCount + "/" + totalPostCount})
          </span>
        </div>
      </div>
      <div className="space-y-4">
        {items.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center">
            <h3 className="text-lg font-semibold">No matching posts</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {search.trim()
                ? `No posts match “${search.trim()}”${selectedTag ? ` in “${selectedTag}”` : ""}.`
                : `There are no posts tagged “${selectedTag}”.`}
            </p>
            {search.trim() && (
              <button
                type="button"
                onClick={onClearSearch}
                className="mt-4 inline-flex min-h-11 items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Clear search
              </button>
            )}
          </div>
        )}
        {items.map((item) => {
          const postKey = postKeyFor(item);
          const match = matchByPostKey.get(postKey);
          let preview: ReactNode;
          if (item.collection === "blog") {
            preview = <BlogPreview blog={item} />;
          } else if (item.collection === "log") {
            preview = <LogPreview log={item} />;
          } else {
            preview = <SnackPreview snack={item} />;
          }

          return (
            <div key={`${postKey}-post-list`} className="space-y-2">
              {match && (
                <div className="rounded-lg border border-border/70 bg-muted/35 px-4 py-3 text-sm">
                  <p className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {match.heading
                      ? `Found in ${match.heading}`
                      : "Found in post text"}
                  </p>
                  <p className="mt-1 leading-6 text-foreground/80">
                    {match.excerpt}
                  </p>
                </div>
              )}
              {preview}
            </div>
          );
        })}
      </div>
    </>
  );
};

const Search = ({
  search,
  setSearch,
  searchIndexStatus,
  onSearchIntent,
}: {
  search: string;
  setSearch: (search: string) => void;
  searchIndexStatus: SearchIndexStatus;
  onSearchIntent: () => void;
}) => {
  const isSearching = Boolean(search.trim());
  const statusMessage =
    searchIndexStatus === "loading"
      ? "Loading the full post index…"
      : searchIndexStatus === "fallback"
        ? "Full-text search is unavailable. Searching titles, descriptions, tags, and URLs instead."
        : "Searching titles, descriptions, tags, headings, URLs, and full post text.";

  return (
    <div className="mx-auto w-full max-w-screen-xl">
      <label htmlFor="tag-search" className="mb-2 block text-sm font-medium">
        Search posts
      </label>
      <div className="relative">
        <input
          id="tag-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          onFocus={onSearchIntent}
          onPointerDown={onSearchIntent}
          aria-busy={searchIndexStatus === "loading"}
          aria-describedby={isSearching ? "tag-search-status" : undefined}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 pl-11 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Search titles, tags, headings, and full post text"
        />
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
        </span>
      </div>
      {isSearching && (
        <p
          id="tag-search-status"
          role="status"
          aria-live="polite"
          className="mt-2 text-xs text-muted-foreground"
        >
          {statusMessage}
        </p>
      )}
    </div>
  );
};
