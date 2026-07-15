import { kebabCase } from "@/utils/helpers";

export default function TagsList({
  tags,
  wrap = false,
}: {
  tags: string[];
  wrap?: boolean;
}) {
  const kebabCasedTags = tags.map((e) => kebabCase(e));
  return (
    <>
      <style>{`
        .tags-scroll {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }
        .tags-scroll:hover {
          scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
        }
        .tags-scroll::-webkit-scrollbar {
          height: 3px;
          transition: height 0.2s ease;
        }
        .tags-scroll:hover::-webkit-scrollbar {
          height: 8px;
        }
        .tags-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .tags-scroll::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: var(--radius-xs);
          transition: background 0.2s ease;
        }
        .tags-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: var(--radius-sm);
        }
        .tags-scroll--wrap {
          flex-wrap: wrap;
          overflow-x: visible;
        }
      `}</style>
      <div
        className={`tags-scroll flex w-full min-w-0 max-w-full gap-2 ${
          wrap
            ? "tags-scroll--wrap"
            : "flex-nowrap overflow-x-auto"
        }`}
      >
        {kebabCasedTags.map((tag) => (
          <a
            key={tag}
            className="site-chip flex-shrink-0 whitespace-nowrap border border-transparent bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
            href={"/tags/" + tag + "/"}
          >
            {tag}
          </a>
        ))}
      </div>
    </>
  );
}
