import { useEffect, useRef, useState, useMemo } from "react";
import BlogPreview from "./BlogPreview";
import LogPreview from "./LogPreview";
import SnackPreview from "./SnackPreview";
import type { CollectionEntry } from "astro:content";

type TagViewProps = {
  blogs: CollectionEntry<"blog">[];
  logs: CollectionEntry<"log">[];
  snacks: CollectionEntry<"snacks">[];
  tags: Map<string, number>;
  preSelectedTag?: string;
  initialSearchQuery?: string;
};
export default function TagView({
  blogs,
  logs,
  snacks,
  tags,
  preSelectedTag,
  initialSearchQuery = "",
}: TagViewProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(
    preSelectedTag ?? null,
  );

  const searchQueryInPost = (
    search: string,
    post:
      | CollectionEntry<"blog">
      | CollectionEntry<"log">
      | CollectionEntry<"snacks">,
  ) => {
    if (!search || search.trim() === "") {
      return true;
    }
    const searchLower = search.toLowerCase();
    if (post.data.title.toLowerCase().includes(searchLower)) {
      return true;
    }
    if (post.data.description.toLowerCase().includes(searchLower)) {
      return true;
    }
    if (post.data.tags.some(tag => tag.toLowerCase().includes(searchLower))) {
      return true;
    }
    if (post.body?.toLowerCase().includes(searchLower)) {
      return true;
    }

    return false;
  };

  // Read search from URL on client side to ensure it's correct after hydration
  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('q') || initialSearchQuery || "";
    }
    return initialSearchQuery || "";
  });
  const isInitialMount = useRef(true);
  
  // Ensure search is synced with URL on mount (in case of hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSearch = urlParams.get('q') || "";
      if (urlSearch !== search) {
        setSearch(urlSearch);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use useMemo to calculate filtered results - this will update when search or selectedTag changes
  const { selectedBlogs, selectedLogs, selectedSnacks } = useMemo(() => {
    // Ensure we're using the current search value
    const currentSearch = search.trim();
    
    const selBlogs = blogs
      .filter((blog) =>
        selectedTag ? blog.data.tags.includes(selectedTag) : true,
      )
      .filter((blog) => searchQueryInPost(currentSearch, blog));
    const selLogs = logs
      .filter((log) =>
        selectedTag ? log.data.tags.includes(selectedTag) : true,
      )
      .filter((log) => searchQueryInPost(currentSearch, log));
    const selSnacks = snacks
      .filter((snack) =>
        selectedTag ? snack.data.tags.includes(selectedTag) : true,
      )
      .filter((snack) => searchQueryInPost(currentSearch, snack));
    return { selectedBlogs: selBlogs, selectedLogs: selLogs, selectedSnacks: selSnacks };
  }, [blogs, logs, snacks, selectedTag, search]);

  const activePostCount =
    selectedBlogs.length + selectedLogs.length + selectedSnacks.length;
  const totalPostCount = blogs.length + logs.length + snacks.length;

  // Update URL when search changes (but don't add to history stack)
  useEffect(() => {
    // Skip URL update on initial mount to avoid redirect issues
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const url = new URL(window.location.href);
    if (search) {
      url.searchParams.set('q', search);
    } else {
      url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url.toString());
  }, [search]);

  return (
    <>
      <div className="grid grid-cols-6 gap-4 p-4">
        <div className="col-span-6 md:col-span-2">
          <TagList
            tags={tags}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
          />
        </div>
        <div className="col-span-6 md:col-span-4">
          <PostList
            blogs={selectedBlogs}
            logs={selectedLogs}
            snacks={selectedSnacks}
            activePostCount={activePostCount}
            totalPostCount={totalPostCount}
            search={search}
            setSearch={setSearch}
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
  tags: Map<string, number>;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(selectedTag == null);

  return (
    <div className="sticky top-28">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-2xl font-bold">Tags:</h3>
          <span className="font-mono text-2xl text-muted-foreground">
            ({tags.size})
          </span>
        </div>
        <button
          onClick={() => setIsExpanded((prev) => !prev)}
          className="rounded-full p-1 hover:bg-accent"
          aria-label={isExpanded ? "Collapse tag list" : "Expand tag list"}
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
        className="flex flex-wrap gap-2 sm:gap-6 md:gap-3 lg:gap-4"
        aria-label="All tags with blog post counts"
      >
        {Array.from(tags)
          .filter(([tag]) => isExpanded || tag === selectedTag)
          .sort((a, b) => {
            return a[0].localeCompare(b[0]);
          })
          .map(([tagName, count]) => (
            <li key={tagName}>
              <button
                onClick={() => {
                  if (selectedTag === tagName) {
                    setSelectedTag(null);
                    setIsExpanded(true);
                    window.location.href = "/tags/";
                  } else {
                    setSelectedTag(tagName);
                    window.location.href = `/tags/${tagName}/`;
                  }
                }}
                className={
                  "relative inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold text-foreground" +
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
  blogs,
  logs,
  snacks,
  activePostCount,
  totalPostCount,
  search,
  setSearch,
}: {
  blogs: CollectionEntry<"blog">[];
  logs: CollectionEntry<"log">[];
  snacks: CollectionEntry<"snacks">[];
  activePostCount: number;
  totalPostCount: number;
  search: string;
  setSearch: (search: string) => void;
}) => {
  const items = [
    ...blogs.map((blog) => ({
      type: "blog",
      releaseDate: blog.data.releaseDate,
      url: blog.id,
      content: blog,
    })),
    ...logs.map((log) => ({
      type: "log",
      releaseDate: log.data.releaseDate,
      url: log.id,
      content: log,
    })),
    ...snacks.map((snack) => ({
      type: "snacks",
      releaseDate: snack.data.releaseDate,
      url: snack.id,
      content: snack,
    })),
  ];
  items.sort((a, b) => {
    return (
      b.content.data.releaseDate.getTime() -
      a.content.data.releaseDate.getTime()
    );
  });
  return (
    <>
      <div className="mb-4 flex justify-between gap-2">
        <div className="flex items-center">
          <h2 className="text-2xl font-bold">Posts:</h2>
          <span className="font-mono text-2xl text-muted-foreground">
            ({activePostCount + "/" + totalPostCount})
          </span>
        </div>
        <div>
          <Search search={search} setSearch={setSearch} />
        </div>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          if (item.type === "blog") {
            return (
              <BlogPreview
                key={item.url + "-post-list"}
                blog={item.content as CollectionEntry<"blog">}
              />
            );
          }
          if (item.type === "log") {
            return (
              <LogPreview
                key={item.url + "-post-list"}
                log={item.content as CollectionEntry<"log">}
              />
            );
          }
          return (
            <SnackPreview
              key={item.url + "-post-list"}
              snack={item.content as CollectionEntry<"snacks">}
            />
          );
        })}
      </div>
    </>
  );
};

const Search = ({
  search,
  setSearch,
}: {
  search: string;
  setSearch: (search: string) => void;
}) => {
  const [isActive, setIsActive] = useState(!!search);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-show search if there's a query
    if (search) {
      setIsActive(true);
    }
  }, [search]);
  return (
    <div className="relative flex">
      <input
        id="search"
        type="text"
        ref={inputRef}
        value={search}
        onInput={(e) => setSearch(e.currentTarget.value)}
        className={
          "flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 " +
          (!isActive ? " hidden" : " ")
        }
        placeholder="Search"
      />
      <button
        onClick={() => {
          if (isActive) {
            // Closing search - clear it
            setSearch("");
          }
          setIsActive(!isActive);
          if (!isActive && inputRef.current) {
            setTimeout(() => {
              inputRef.current?.focus();
            }, 50);
          }
        }}
        className="absolute right-2 top-2"
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
          className="h-4 w-4 text-muted-foreground"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
      </button>
    </div>
  );
};
