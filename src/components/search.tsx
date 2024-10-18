import { $, component$, useSignal } from "@builder.io/qwik";
import { getBogs } from "~/routes/blog/layout";
import { getLogs } from "~/routes/dev-log/layout";
import { type ItemsType } from "~/routes/tags";

type SearchProps = {
  originalItems: ItemsType[];
  updateItems: (newItems: ItemsType[]) => void;
};

export const Search = component$<SearchProps>(
  ({ originalItems, updateItems }) => {
    const isActive = useSignal(false);
    const searchQuery = useSignal("");
    const options = getAllOptions();

    const filterOptions = $(function filterOptions(search: string) {
      const filtered = options.filter((option) => {
        return option.text.toLowerCase().includes(search.toLowerCase());
      });
      const filteredItems = originalItems.filter((item) =>
        filtered.some((option) => option.url === item.url),
      );
      updateItems(filteredItems);
    });

    return (
      <div class="relative flex">
        {isActive.value === true && (
          <input
            type="text"
            onInput$={(e) => {
              const target = e.target as HTMLInputElement;
              searchQuery.value = target.value;
              filterOptions(target.value);
            }}
            class="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Search"
          />
        )}
        <button
          onClick$={() => (isActive.value = !isActive.value)}
          class="absolute right-2 top-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
        </button>
      </div>
    );
  },
);
export default Search;

type Option = {
  title: string;
  description: string;
  url: string;
  text: string;
};

function getAllOptions() {
  const options: Option[] = [];
  const blogs = getBogs();
  for (const blog of blogs) {
    options.push({
      title: blog.title,
      description: blog.description,
      url: blog.slug,
      text: [
        blog.tags.join(", "),
        blog.title,
        blog.description,
        blog.headings,
      ].join(" "),
    });
  }
  const logs = getLogs();
  for (const log of logs) {
    options.push({
      title: log.title,
      description: log.description,
      url: log.url,
      text: [
        log.tags.join(", "),
        log.title,
        log.description,
        log.headings,
      ].join(" "),
    });
  }
  return options;
}
