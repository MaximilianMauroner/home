import {
  $,
  component$,
  type JSXOutput,
  type Signal,
  useComputed$,
  useSignal,
  useStore,
  useTask$,
  useVisibleTask$,
} from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";
import { type BlogType, getBogs } from "../blog/layout";
import { getLogs, type LogType } from "../dev-log/layout";
import { calculateRelativeDate, kebabCase } from "~/components/utils";
import { BlogPreview } from "../blog";
import { LogPreview } from "../dev-log";
import Search from "~/components/search";

type TagType = {
  name: string;
  blogCount: number;
  logCount: number;
};

export function getTagInformation() {
  const blogs = getBogs().filter(
    (b) =>
      import.meta.env.DEV ||
      (b.published && calculateRelativeDate(b.releaseDate) >= 0),
  );
  const logs = getLogs().filter(
    (l) =>
      import.meta.env.DEV ||
      (l.published && calculateRelativeDate(l.releaseDate) >= 0),
  );

  const tags = new Map<string, { blogCount: number; logCount: number }>();

  blogs.forEach((b) => {
    if (
      !import.meta.env.DEV &&
      b.published === false &&
      calculateRelativeDate(b.releaseDate) < 0
    )
      return;
    b.tags.forEach((t) => {
      const tagName = kebabCase(t);
      const tt = tags.get(tagName);
      if (tt) {
        tt.blogCount++;
        tags.set(tagName, tt);
      } else {
        tags.set(tagName, { blogCount: 1, logCount: 0 });
      }
    });
  });

  logs.forEach((l) => {
    if (
      !import.meta.env.DEV &&
      l.published === false &&
      calculateRelativeDate(l.releaseDate) < 0
    )
      return;
    l.tags.forEach((t) => {
      const tagName = kebabCase(t);
      const tt = tags.get(tagName);
      if (tt) {
        tt.logCount++;
        tags.set(tagName, tt);
      } else {
        tags.set(tagName, { blogCount: 0, logCount: 1 });
      }
    });
  });

  const tagsArray = Array.from(tags.keys()).map((t) => {
    return {
      name: t,
      blogCount: tags.get(t)?.blogCount ?? 0,
      logCount: tags.get(t)?.logCount ?? 0,
    };
  });
  tagsArray.sort((a, b) => a.name.localeCompare(b.name));

  return { tags: tagsArray, blogs, logs };
}
export const useTagLoader = routeLoader$(async () => {
  return getTagInformation();
});

export default component$(() => {
  const { tags, blogs, logs } = useTagLoader().value;
  return (
    <>
      <TagView tags={tags} blogs={blogs} logs={logs} />
    </>
  );
});

export const TagView = component$<{
  tags: TagType[];
  blogs: BlogType[];
  logs: LogType[];
  preSelectedTag?: string;
}>(
  ({
    tags,
    blogs,
    logs,
    preSelectedTag,
  }: {
    tags: TagType[];
    blogs: BlogType[];
    logs: LogType[];
    preSelectedTag?: string;
  }) => {
    const selectedTag = useSignal<string>(preSelectedTag ?? "");

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(() => {
      const handlePopState = () => {
        const path = window.location.pathname.split("/tags/")[1];
        selectedTag.value = path || ""; // Update the selectedTag based on URL
      };

      window.addEventListener("popstate", handlePopState);

      // Clean up listener when component unmounts
      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    });

    const selectedBlogs = useComputed$(() => {
      if (selectedTag.value === "") {
        return blogs;
      }
      return blogs.filter((b) => b.tags.includes(selectedTag.value));
    });
    const selectedLogs = useComputed$(() => {
      if (selectedTag.value === "") {
        return logs;
      }
      return logs.filter((l) => l.tags.includes(selectedTag.value));
    });
    const totalPostCount = useComputed$(() => {
      return blogs.length + logs.length;
    });
    const activePostCount = useComputed$(() => {
      return selectedBlogs.value.length + selectedLogs.value.length;
    });
    return (
      <div class="grid grid-cols-6 gap-4 p-4">
        <div class="col-span-6 sm:col-span-2">
          <TagList tags={tags} selectedTag={selectedTag} />
        </div>
        <div class="col-span-6 sm:col-span-4">
          <PostList
            blogs={selectedBlogs}
            logs={selectedLogs}
            activePostCount={activePostCount}
            totalPostCount={totalPostCount}
          />
        </div>
      </div>
    );
  },
);

const TagList = component$<{
  tags: TagType[];
  selectedTag: Signal<string>;
}>(
  ({ tags, selectedTag }: { tags: TagType[]; selectedTag: Signal<string> }) => {
    return (
      <div class="sticky top-28">
        <div class="mb-4 flex items-center gap-2">
          <h2 class="text-2xl font-bold">Tags:</h2>
          <span class="font-mono text-2xl text-muted-foreground">
            ({tags.length})
          </span>
        </div>
        <ul
          class="flex flex-wrap gap-2 sm:gap-6 md:gap-3 lg:gap-4"
          aria-label="All tags with blog post counts"
        >
          {tags.map((tag) => {
            return (
              <li key={tag.name}>
                <button
                  onClick$={() => {
                    if (selectedTag.value === tag.name) {
                      selectedTag.value = "";
                      window.history.replaceState({}, "", "/tags/"); // Keep this as replace for clearing the tag
                    } else {
                      selectedTag.value = tag.name;
                      window.history.pushState(
                        {},
                        "",
                        `/tags/${selectedTag.value}`,
                      ); // Switch to pushState for adding a new history entry
                    }
                  }}
                  class={
                    "relative inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-semibold text-foreground" +
                    (selectedTag.value === tag.name
                      ? "outline-none ring-2 ring-ring"
                      : "")
                  }
                >
                  <span>{tag.name}</span>
                  <span class="pl-1 text-sm text-muted-foreground">
                    {tag.blogCount + tag.logCount}
                  </span>
                  {selectedTag.value === tag.name && (
                    <span class="absolute right-0 top-0 -translate-y-[50%] translate-x-[50%] rounded-full bg-black text-white">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="size-4"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);

export type ItemsType = {
  releaseDate: string;
  url: string;
  component: JSXOutput;
};

const PostList = component$<{
  blogs: Signal<BlogType[]>;
  logs: Signal<LogType[]>;
  totalPostCount: Signal<number>;
  activePostCount: Signal<number>;
}>(
  ({
    blogs,
    logs,
    totalPostCount,
    activePostCount,
  }: {
    blogs: Signal<BlogType[]>;
    logs: Signal<LogType[]>;
    totalPostCount: Signal<number>;
    activePostCount: Signal<number>;
  }) => {
    const state = useStore<{ items: ItemsType[]; originalItems: ItemsType[] }>({
      items: [], // initially empty
      originalItems: [], // initially empty
    });

    // Track changes in blogs and logs, initialize and update state.items accordingly
    useTask$(({ track }) => {
      // Track both blogs and logs signals
      const trackedBlogs = track(() => blogs.value);
      const trackedLogs = track(() => logs.value);

      // Generate updated items based on blogs and logs
      const updatedItems = [
        ...trackedBlogs.map((blog) => ({
          releaseDate: blog.releaseDate,
          url: blog.slug,
          component: <BlogPreview key={blog.slug + "-post-list"} post={blog} />,
        })),
        ...trackedLogs.map((log) => ({
          releaseDate: log.releaseDate,
          url: log.url,
          component: <LogPreview key={log.title + "-post-list"} post={log} />,
        })),
      ];

      // Update state with the new items and keep a copy in originalItems
      state.items = updatedItems;
      state.originalItems = [...updatedItems]; // keep original copy of items

      // Sort the items by release date
      state.items.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
    });

    // Function to update the displayed items, used by the Search component
    const updateItems = $((newItems: ItemsType[]) => {
      state.items = newItems;
    });

    return (
      <>
        <div class="mb-4 flex justify-between gap-2">
          <div class="flex items-center">
            <h2 class="text-2xl font-bold">Tags:</h2>
            <span class="font-mono text-2xl text-muted-foreground">
              ({activePostCount.value + "/" + totalPostCount.value})
            </span>
          </div>
          <div>
            <Search
              originalItems={state.originalItems}
              updateItems={updateItems}
            />
          </div>
        </div>
        <div class="space-y-4">{state.items.map((item) => item.component)}</div>
      </>
    );
  },
);

export const head: DocumentHead = () => {
  return {
    title: `<Tags>`,
  };
};
