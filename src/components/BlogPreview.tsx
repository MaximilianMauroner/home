import type { CollectionEntry } from "astro:content";
import TagsList from "./TagsList";
import type { ReactNode } from "react";
import { timeAgo } from "@/utils/helpers";

export default function BlogPreview({
  blog,
  image,
}: {
  blog: CollectionEntry<"blog">;
  image?: ReactNode; // Make image prop optional
}) {
  return (
    <article className="relative rounded-lg border border-gray-200 bg-card p-4 shadow-md sm:p-6">
      {image && image} {/* Only render image if it exists */}
      <div className="relative z-20">
        <div className="mb-5 flex flex-col items-center justify-between gap-1 sm:flex-row">
          <div className="inline-flex items-center overflow-hidden rounded px-2 py-0.5 text-xs font-medium text-primary">
            <div className="flex flex-nowrap overflow-hidden">
              <TagsList tags={blog.data.tags} />
            </div>
          </div>
          <span className="shrink-0 whitespace-nowrap text-right text-xs text-muted-foreground sm:text-sm">
            {timeAgo(blog.data.releaseDate)}
          </span>
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-primary underline-offset-4 hover:underline">
          <a href={`/blog/${blog.id}/`}>{blog.data.title}</a>
        </h2>
        <p className="mb-5 font-light text-muted-foreground">
          {blog.data.description}
        </p>
        <div className="flex items-center justify-between text-xs font-medium text-primary ring-offset-background sm:text-sm">
          <a
            href={`/blog/${blog.id}/`}
            className="inline-flex items-center font-medium text-primary hover:underline"
          >
            Read more
            <svg
              className="ml-1 h-3 w-3 sm:ml-2 sm:h-4 sm:w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              ></path>
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}
