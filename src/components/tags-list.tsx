import { component$ } from "@builder.io/qwik";
import { useDocumentHead } from "@builder.io/qwik-city";
import { kebabCase } from "./utils";

const TagsList = component$(({ tags }: { tags: string[] }) => {
  const kebabCasedTags = tags.map((tag: string) => kebabCase(tag));

  return (
    <div class="flex gap-1">
      {kebabCasedTags.map((tag) => (
        <a
          key={tag}
          class="whitespace-nowrap rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground no-underline hover:bg-primary hover:text-primary-foreground"
          href={"/tags/" + tag}
        >
          {tag}
        </a>
      ))}
    </div>
  );
});

export const FontmatterTagsList = component$(() => {
  const { frontmatter } = useDocumentHead();

  if (frontmatter.tags.length === 0) {
    return null;
  }

  return (
    <div class="py-2 font-mono">
      <h2 class="mb-2 text-lg font-semibold">Tags</h2>
      <TagsList tags={frontmatter.tags} />
    </div>
  );
});

export default TagsList;
