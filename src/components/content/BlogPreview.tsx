import type { CollectionEntry } from "astro:content";
import type { ReactNode } from "react";
import "./BlogPreview.css";

const localImageUrls = import.meta.glob<string>(
  "/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}",
  { eager: true, import: "default", query: "?url" },
);

type BlogPreviewEntry = CollectionEntry<"blog"> & { _imageUrl?: string | null };

export default function BlogPreview({
  blog,
  image,
}: {
  blog: BlogPreviewEntry;
  image?: ReactNode;
}) {
  const href = `/blog/${blog.id}/`;
  const titleTransitionId = `blog-title-${blog.id}`;
  const releaseDate = new Date(blog.data.releaseDate);
  const date = releaseDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const imageUrl =
    blog._imageUrl ??
    (blog.data.image ? localImageUrls[blog.data.image] : undefined);
  const tags = blog.data.tags.slice(0, 4);

  return (
    <article className="blog-map-card group relative isolate flex h-full min-h-[25rem] flex-col overflow-hidden rounded-[var(--radius-md)] border bg-[var(--map)] p-[clamp(1.25rem,3vw,2rem)] text-[var(--ink)] max-[620px]:min-h-[22.5rem] max-[620px]:p-[1.1rem]">
      {image ? (
        <div
          className="blog-map-image absolute bottom-14 right-0 top-0 -z-[3] w-[64%] overflow-hidden max-[620px]:w-[88%] max-[620px]:opacity-40"
          aria-hidden="true"
        >
          {image}
        </div>
      ) : imageUrl ? (
        <div className="blog-map-image absolute bottom-14 right-0 top-0 -z-[3] w-[64%] overflow-hidden max-[620px]:w-[88%] max-[620px]:opacity-40">
          <img src={imageUrl} alt="" />
        </div>
      ) : null}

      <div
        className="blog-map-contours pointer-events-none absolute right-[-8%] top-[47%] -z-[1] aspect-[1.2] w-[min(75%,28rem)] -translate-y-1/2 -rotate-[7deg] max-[620px]:-right-36 max-[620px]:w-[27rem] max-[620px]:opacity-[0.52]"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
        <span />
        <span />
        <i className="transition-transform duration-200 group-hover:scale-[1.18] motion-reduce:transform-none motion-reduce:transition-none" />
      </div>

      <div className="blog-map-meta mb-[0.8rem] flex items-center justify-between gap-4 border-b pb-[0.55rem] font-mono text-[0.64rem] font-extrabold uppercase tracking-[0.08em] text-[var(--marker)] max-[620px]:mb-[0.6rem] max-[620px]:pb-[0.45rem]">
        <time dateTime={releaseDate.toISOString()}>{date}</time>
        <span>{blog.data.type ?? "Essay"}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center py-[0.45rem] pb-4 max-[620px]:py-1 max-[620px]:pb-[0.8rem]">
        <h2 className="mb-3 max-w-[15ch] text-balance text-[clamp(2rem,4.2vw,3.5rem)] font-[780] leading-[0.9] tracking-[-0.065em] [overflow-wrap:anywhere] max-[620px]:mb-[0.55rem] max-[620px]:text-[clamp(1.95rem,9.5vw,2.3rem)]">
          <a
            href={href}
            aria-label={`Read ${blog.data.title}`}
            data-astro-prefetch="hover"
            className="text-inherit no-underline after:absolute after:inset-0 after:content-[''] focus-visible:rounded-[var(--radius-xs)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[6px] focus-visible:outline-[var(--ink)]"
            style={{ viewTransitionName: titleTransitionId }}
          >
            {blog.data.title}
          </a>
        </h2>
        <p className="m-0 max-w-[48ch] text-[0.92rem] leading-6 max-[620px]:text-[0.86rem] max-[620px]:leading-[1.42]">
          {blog.data.description}
        </p>
      </div>

      <footer className="blog-map-footer z-[1] flex flex-wrap items-end justify-between gap-4 border-t pt-[0.7rem] font-mono text-[0.64rem] font-extrabold uppercase tracking-[0.08em] max-[620px]:flex-col max-[620px]:items-stretch max-[620px]:gap-[0.55rem] max-[620px]:pt-[0.65rem]">
        {tags.length > 0 && (
          <ol
            className="m-0 flex list-none flex-wrap gap-x-3 gap-y-[0.35rem] p-0 max-[620px]:w-full max-[620px]:flex-nowrap max-[620px]:justify-between max-[620px]:gap-[0.35rem]"
            aria-label="Topics"
          >
            {tags.map((tag, index) => (
              <li
                className="flex gap-1 max-[620px]:gap-[0.2rem] max-[620px]:text-[0.57rem]"
                key={tag}
              >
                <span className="text-[var(--marker)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {tag}
              </li>
            ))}
          </ol>
        )}
        <span
          className="ml-auto shrink-0 text-[var(--marker)] max-[620px]:ml-0 max-[620px]:self-end"
          aria-hidden="true"
        >
          Follow trail{" "}
          <b className="inline-block transition-transform duration-200 group-hover:-translate-y-[0.15rem] group-hover:translate-x-[0.15rem] motion-reduce:transform-none motion-reduce:transition-none">
            ↗
          </b>
        </span>
      </footer>
    </article>
  );
}
