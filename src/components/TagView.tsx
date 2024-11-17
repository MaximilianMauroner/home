import type { BlogType, LogType } from "@/utils/types";
import { useEffect, useState } from "react";
import BlogPreview from "./BlogPreview";
import LogPreview from "./LogPreview";

type TagViewProps = {
  blogs: BlogType[];
  logs: LogType[];
  tags: Map<string, number>;
  preSelectedTag?: string;
};
export default function TagView({
  blogs,
  logs,
  tags,
  preSelectedTag,
}: TagViewProps) {
  const [selectedTag, setSelectedTag] = useState<string | null>(
    preSelectedTag ?? null
  );
  const [selectedBlogs, setSelectedBlogs] = useState<BlogType[]>(blogs);
  const [selectedLogs, setSelectedLogs] = useState<LogType[]>(logs);
  const [search, setSearch] = useState<string>("");
  const activePostCount = selectedBlogs.length + selectedLogs.length;
  const totalPostCount = blogs.length + logs.length;

  useEffect(() => {
    setSelectedBlogs(
      selectedTag
        ? blogs.filter((blog) => blog.tags.includes(selectedTag))
        : blogs
    );
    setSelectedLogs(
      selectedTag ? logs.filter((log) => log.tags.includes(selectedTag)) : logs
    );
  }, [selectedTag]);

  return (
    <>
      <div className="grid grid-cols-6 gap-4 p-4">
        <div className="col-span-6 sm:col-span-2">
          <TagList
            tags={tags}
            selectedTag={selectedTag}
            setSelectedTag={setSelectedTag}
          />
        </div>
        <div className="col-span-6 sm:col-span-4">
          <PostList
            blogs={selectedBlogs}
            logs={selectedLogs}
            activePostCount={activePostCount}
            totalPostCount={totalPostCount}
            search={search}
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
  return (
    <div className="sticky top-28">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-2xl font-bold">Tags:</h2>
        <span className="font-mono text-2xl text-muted-foreground">
          ({tags.size})
        </span>
      </div>
      <ul
        className="flex flex-wrap gap-2 sm:gap-6 md:gap-3 lg:gap-4"
        aria-label="All tags with blog post counts"
      >
        {Array.from(tags).map(([tagName, count]) => (
          <li key={tagName}>
            <button
              onClick={() => {
                if (selectedTag === tagName) {
                  setSelectedTag(null);
                  window.history.replaceState({}, "", "/tags/");
                } else {
                  setSelectedTag(tagName);
                  window.history.pushState({}, "", `/tags/${tagName}`);
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
  activePostCount,
  totalPostCount,
  search,
}: {
  blogs: BlogType[];
  logs: LogType[];
  activePostCount: number;
  totalPostCount: number;
  search: string;
}) => {
  const items = [
    ...blogs.map((blog) => ({
      type: "blog",
      releaseDate: blog.releaseDate,
      url: blog.slug,
      content: blog,
    })),
    ...logs.map((log) => ({
      type: "log",
      releaseDate: log.releaseDate,
      url: log.url,
      content: log,
    })),
  ];
  items.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  return (
    <>
      <div className="mb-4 flex justify-between gap-2">
        <div className="flex items-center">
          <h2 className="text-2xl font-bold">Posts:</h2>
          <span className="font-mono text-2xl text-muted-foreground">
            ({activePostCount + "/" + totalPostCount})
          </span>
        </div>
        <div>{/* <Search searchQuery={search} /> */}</div>
      </div>
      <div className="space-y-4">
        {items.map((item) => {
          if (item.type === "blog") {
            return (
              <BlogPreview
                key={item.url + "-post-list"}
                blog={item.content as BlogType}
              />
            );
          }
          return (
            <LogPreview
              key={item.url + "-post-list"}
              log={item.content as LogType}
            />
          );
        })}
      </div>
    </>
  );
};
