import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./TagView.css";
import type { TaggedPreviewEntry } from "./previewTypes";
import type { PostSearch } from "./postSearchClient";
import type { PostSearchMatch } from "@/utils/postSearch";

type TagViewProps = {
  posts: TaggedPreviewEntry[];
  tags: Array<[string, number]>;
  preSelectedTag?: string;
  initialSearchQuery?: string;
  /** Curated reading path for the selected topic, in reading order. */
  startHere?: TaggedPreviewEntry[];
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
  startHere = [],
}: TagViewProps) {
  const selectedTag = preSelectedTag ?? null;

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

  const topicPosts = selectedTag
    ? posts.filter((post) => post.data.tags.includes(selectedTag))
    : posts;
  const connections = new Map<string, number>();
  for (const post of topicPosts) {
    for (const tag of new Set(post.data.tags)) {
      if (tag !== selectedTag)
        connections.set(tag, (connections.get(tag) ?? 0) + 1);
    }
  }
  const nearbyTopics = [...connections]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6);
  const tagHref = (tag: string | null) => {
    const path = tag ? `/tags/${encodeURIComponent(tag)}/` : "/tags/";
    return search.trim()
      ? `${path}?${new URLSearchParams({ q: search })}`
      : path;
  };

  return (
    <div className="topic-atlas">
      <div className="topic-atlas__search">
        <Search
          search={search}
          searchIndexStatus={searchIndexStatus}
          setSearch={setSearch}
          onSearchIntent={() => void loadSearchIndex()}
        />
      </div>
      <div className="topic-atlas__layout">
        <aside className="topic-atlas__index">
          <details open>
            <summary>
              Topic index <span>{tags.length}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <nav aria-label="Topics">
              <a
                href={tagHref(null)}
                aria-current={!selectedTag ? "page" : undefined}
              >
                <span>All topics</span>
                <span>{totalPostCount}</span>
              </a>
              {[...tags]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([tag, count]) => (
                  <a
                    key={tag}
                    href={tagHref(tag)}
                    aria-current={selectedTag === tag ? "page" : undefined}
                  >
                    <span>{tag}</span>
                    <span>{count}</span>
                  </a>
                ))}
            </nav>
          </details>
        </aside>
        <section className="topic-atlas__results" aria-label="Posts by topic">
          <div className="topic-atlas__map">
            <div className="topic-atlas__scope">
              <h2>{selectedTag ?? "All topics"}</h2>
              <a href="#topic-posts">
                {topicPosts.length} posts <Arrow />
              </a>
            </div>
            <p>
              {selectedTag
                ? "Connected topics, ranked by shared posts."
                : "Pick a starting point. See where it takes you."}
            </p>
            {nearbyTopics.length > 0 && (
              <nav
                className="topic-atlas__connections"
                aria-label={selectedTag ? "Related topics" : "Frequent topics"}
              >
                {nearbyTopics.map(([tag, count]) => (
                  <a href={tagHref(tag)} key={tag}>
                    <i aria-hidden="true" />
                    <span>{tag}</span>
                    <span className="topic-atlas__connection-count">
                      {count}
                      <span className="sr-only">
                        {" "}
                        {selectedTag ? "shared posts" : "posts"}
                      </span>
                    </span>
                  </a>
                ))}
              </nav>
            )}
            {startHere.length > 0 && !search.trim() && (
              <nav
                className="topic-atlas__start"
                aria-labelledby="topic-start-heading"
              >
                <h3 id="topic-start-heading">Start here</h3>
                <ol>
                  {startHere.map((post) => {
                    const collection = collectionDetails[post.collection];
                    return (
                      <li key={postKeyFor(post)}>
                        <a href={`/${collection.path}/${post.id}/`}>
                          {post.data.title}
                        </a>
                        <span>{collection.label}</span>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </div>
          <PostList
            tagHref={tagHref}
            posts={selectedPosts}
            activePostCount={activePostCount}
            search={search}
            selectedTag={selectedTag}
            onClearSearch={clearSearch}
            matchByPostKey={matchByPostKey}
            preserveOrder={hasCurrentFullTextResults && Boolean(deferredSearch)}
          />
        </section>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}

const collectionDetails = {
  blog: { label: "Blog", path: "blog", transition: "blog" },
  log: { label: "Dev log", path: "dev-log", transition: "devlog" },
  snacks: { label: "Snack", path: "snacks", transition: "snack" },
};

const PostList = ({
  tagHref,
  posts,
  activePostCount,
  search,
  selectedTag,
  onClearSearch,
  matchByPostKey,
  preserveOrder,
}: {
  tagHref: (tag: string | null) => string;
  posts: TaggedPreviewEntry[];
  activePostCount: number;
  search: string;
  selectedTag: string | null;
  onClearSearch: () => void;
  matchByPostKey: Map<string, PostSearchMatch>;
  preserveOrder: boolean;
}) => {
  const items = [...posts];
  if (!preserveOrder) {
    items.sort(
      (a, b) =>
        new Date(b.data.releaseDate).getTime() -
        new Date(a.data.releaseDate).getTime(),
    );
  }
  return (
    <div id="topic-posts" className="topic-posts">
      <div className="topic-posts__header">
        <h3>{search.trim() ? "Search results" : "Latest writing"}</h3>
        <span role="status" aria-live="polite" aria-atomic="true">
          {activePostCount} {activePostCount === 1 ? "post" : "posts"}
          {search.trim() ? ` for “${search.trim()}”` : ""}
        </span>
      </div>
      {items.length === 0 && (
        <div className="topic-posts__empty">
          <h3>No matching posts</h3>
          <p>
            {search.trim()
              ? `No posts match “${search.trim()}”${selectedTag ? ` in “${selectedTag}”` : ""}.`
              : `There are no posts tagged “${selectedTag}”.`}
          </p>
          {search.trim() && (
            <button type="button" onClick={onClearSearch}>
              Clear search
            </button>
          )}
          {selectedTag && (
            <a href={tagHref(null)}>
              Browse all topics <Arrow />
            </a>
          )}
        </div>
      )}
      {items.map((item) => {
        const postKey = postKeyFor(item);
        const match = matchByPostKey.get(postKey);
        const collection = collectionDetails[item.collection];
        const href = `/${collection.path}/${item.id}/`;
        const date = new Date(item.data.releaseDate);
        return (
          <article
            key={postKey}
            className={`topic-post topic-post--${item.collection}`}
          >
            <div className="topic-post__meta">
              <span>
                <i aria-hidden="true" />
                {collection.label}
              </span>
              <time dateTime={date.toISOString()}>
                {date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </div>
            <h4>
              <a
                href={href}
                style={{
                  viewTransitionName: `${collection.transition}-title-${item.id.replaceAll("/", "-")}`,
                }}
              >
                {item.data.title}
                <Arrow />
              </a>
            </h4>
            <p>{item.data.description}</p>
            {match && (
              <div className="topic-post__match">
                <span>
                  {match.heading
                    ? `Found in ${match.heading}`
                    : "Found in post text"}
                </span>
                <p>{match.excerpt}</p>
              </div>
            )}
            <nav
              aria-label={`Topics for ${item.data.title}`}
              className="topic-post__tags"
            >
              {item.data.tags.map((tag) => (
                <a
                  key={tag}
                  href={tagHref(tag)}
                  aria-current={selectedTag === tag ? "page" : undefined}
                >
                  {tag}
                </a>
              ))}
            </nav>
          </article>
        );
      })}
    </div>
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
    <form className="topic-search" role="search" method="get">
      <label htmlFor="tag-search" className="topic-search__label">
        Search posts
      </label>
      <div className="topic-search__field">
        <input
          id="tag-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          onFocus={onSearchIntent}
          onPointerDown={onSearchIntent}
          aria-busy={searchIndexStatus === "loading"}
          aria-describedby={isSearching ? "tag-search-status" : undefined}
          name="q"
          className="topic-search__input"
          placeholder="Search all the writing…"
        />
        <span className="topic-search__icon" aria-hidden="true">
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
    </form>
  );
};
