import { calculateRelativeDate } from "@/utils/helpers";
import type { BlogType } from "@/utils/types";
import TagsList from "./TagsList";

export default function BlogPreview({ blog }: { blog: BlogType }) {
  const releaseDate = calculateRelativeDate(blog.releaseDate);

  return (
    <article className="rounded-lg border border-gray-200 bg-card p-6 shadow-md">
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex items-center overflow-auto rounded px-2.5 py-0.5 text-xs font-medium text-primary">
          <svg
            className="mr-1 h-3 w-3"
            fill="currentColor"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path>
          </svg>
          <div className="flex w-full overflow-auto">
            <TagsList tags={blog.tags} />
          </div>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:block">
          {releaseDate < 0
            ? `releases in ${Math.abs(releaseDate)} days`
            : `released ${releaseDate} days ago`}
        </span>
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-primary underline-offset-4 hover:underline">
        <a href={blog.slug}>{blog.title}</a>
      </h2>
      <p className="mb-5 font-light text-muted-foreground">
        {blog.description}
      </p>
      <div className="flex items-center justify-between text-sm font-medium text-primary underline-offset-4 ring-offset-background transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
        <a
          href={blog.slug}
          className="inline-flex items-center font-medium text-primary hover:underline"
        >
          Read more
          <svg
            className="ml-2 h-4 w-4"
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
    </article>
  );
}
