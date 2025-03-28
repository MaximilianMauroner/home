import { kebabCase } from "@/utils/helpers";

export default function TagsList({ tags }: { tags: string[] }) {
  const kebabCasedTags = tags.map((e) => kebabCase(e));
  return (
    <div className="inline-flex flex-wrap gap-2 overflow-hidden lg:flex-nowrap">
      {kebabCasedTags.map((tag) => (
        <a
          key={tag}
          className="flex-shrink-0 whitespace-nowrap rounded-full border border-transparent bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground no-underline hover:bg-primary hover:text-primary-foreground"
          href={"/tags/" + tag + "/"}
        >
          {tag}
        </a>
      ))}
    </div>
  );
}
