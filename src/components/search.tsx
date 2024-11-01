import { component$, type Signal, useSignal } from "@builder.io/qwik";
type SearchProps = {
  searchQuery: Signal<string>;
};

export const Search = component$<SearchProps>(({ searchQuery }) => {
  const isActive = useSignal(false);
  const inputRef = useSignal<HTMLInputElement>();

  return (
    <div class="relative flex">
      <input
        id="search"
        type="text"
        ref={inputRef}
        bind:value={searchQuery}
        class={
          "flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 " +
          (!isActive.value ? " hidden" : " ")
        }
        placeholder="Search"
      />
      <button
        onClick$={() => {
          isActive.value = !isActive.value;
          if (isActive.value === true && inputRef.value) {
            setTimeout(() => {
              inputRef.value?.focus();
            }, 100);
          }
        }}
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
});
export default Search;
