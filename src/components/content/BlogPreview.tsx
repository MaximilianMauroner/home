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
    <article className="blog-map-card">
      {image ? (
        <div className="blog-map-image" aria-hidden="true">
          {image}
        </div>
      ) : imageUrl ? (
        <div className="blog-map-image">
          <img src={imageUrl} alt="" />
        </div>
      ) : null}

      <div className="blog-map-contours" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <i />
      </div>

      <div className="blog-map-meta">
        <time dateTime={releaseDate.toISOString()}>{date}</time>
        <span>{blog.data.type ?? "Essay"}</span>
      </div>

      <div className="blog-map-content">
        <h2>
          <a
            href={href}
            aria-label={`Read ${blog.data.title}`}
            data-astro-prefetch="hover"
            style={{ viewTransitionName: titleTransitionId }}
          >
            {blog.data.title}
          </a>
        </h2>
        <p>{blog.data.description}</p>
      </div>

      <footer className="blog-map-footer">
        {tags.length > 0 && (
          <ol aria-label="Topics">
            {tags.map((tag, index) => (
              <li key={tag}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {tag}
              </li>
            ))}
          </ol>
        )}
        <span className="blog-map-route" aria-hidden="true">
          Follow trail <b>↗</b>
        </span>
      </footer>
    </article>
  );
}
