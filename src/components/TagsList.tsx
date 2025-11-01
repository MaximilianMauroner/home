import { kebabCase } from "@/utils/helpers";

export default function TagsList({ tags }: { tags: string[] }) {
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
          border-radius: 0;
          transition: background 0.2s ease;
        }
        .tags-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.3);
          border-radius: 4px;
        }
      `}</style>
      <div className="tags-scroll inline-flex max-w-full flex-nowrap gap-2 overflow-auto lg:flex-nowrap">
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
    </>
  );
}
