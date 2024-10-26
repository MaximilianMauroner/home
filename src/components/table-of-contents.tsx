import {
  component$,
  useSignal,
  useStore,
  useVisibleTask$,
} from "@builder.io/qwik";

function prepareHeadings(headingsArr: string[]) {
  const ret = [];
  for (const heading of headingsArr) {
    ret.push({
      id: generateIdFromHeading(heading),
      name: heading,
    });
  }
  return ret;
}

export default component$(({ headingsArr }: { headingsArr: string[] }) => {
  const h = prepareHeadings(headingsArr);
  const wrapperRef = useSignal<HTMLDivElement>();
  const state = useStore({
    activeHeading: h[0]?.name ?? "",
    isHovered: false,
    headings: h,
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.value &&
        !wrapperRef.value.contains(event.target as Node)
      ) {
        // Click was outside of the referenced element
        state.isHovered = false;
      }
    };

    const handleScroll = () => {
      const offset = 80 + 16 + 1; // Adjust for sticky header height
      let activeHeading = "";

      if (window.scrollY === 0) {
        activeHeading = state.headings[0].name; // Set the first heading as active
      } else if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 2
      ) {
        activeHeading = state.headings[state.headings.length - 1].name; // Set the last heading as active
      } else {
        for (let i = state.headings.length - 1; i >= 0; i--) {
          const heading = state.headings[i];
          const headingElement = document.querySelector(
            `[id^="${heading.id}"]`,
          );
          if (headingElement) {
            if (headingElement.id !== heading.id) {
              state.headings[i].id = headingElement.id;
            }
            const top = headingElement.getBoundingClientRect().top - offset;
            if (top <= 0) {
              activeHeading = heading.name;
              break;
            }
          }
        }
      }

      // Update state only if the active heading has changed
      if (state.activeHeading !== activeHeading) {
        state.activeHeading = activeHeading;
      }
    };
    document.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("click", handleClickOutside);
    };
  });

  return (
    <div
      class="fixed bottom-2 sm:left-2 sm:top-1/2 sm:-translate-y-1/2"
      onMouseEnter$={() => (state.isHovered = true)}
      onMouseLeave$={() => (state.isHovered = false)}
      onTouchStart$={() => (state.isHovered = true)}
      ref={wrapperRef}
    >
      {!state.isHovered && (
        <div class="relative">
          <div
            class={`absolute left-0 flex flex-col gap-3 rounded-lg border bg-white p-2 transition-opacity duration-300`}
          >
            {state.headings.map((heading, index) => (
              <div
                key={index}
                class={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${
                  state.activeHeading === heading.name
                    ? "bg-blue-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      <div
        class={`flex flex-col gap-4 rounded-lg border bg-white p-2 transition-all duration-300 ${
          state.isHovered
            ? "-translate-x-0 opacity-100"
            : "pointer-events-none -translate-x-4 opacity-0"
        }`}
      >
        {state.headings.map((heading, index) => (
          <a
            key={index}
            href={`#${heading.id}`}
            class={`text-sm font-semibold ${
              state.activeHeading === heading.name
                ? "text-blue-500"
                : "text-muted-foreground"
            } block scroll-mt-20 text-left`}
          >
            <span class="w-20 overflow-hidden text-ellipsis whitespace-nowrap md:w-48">
              {heading.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
});

function generateIdFromHeading(heading: string): string {
  return heading
    .toLowerCase() // Convert to lowercase
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, "") // Remove non-alphanumerics except hyphens
    .replace(/\uFEFF/g, "");
}
