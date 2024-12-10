import { calculateRelativeDate } from "@/utils/helpers";
import type { CollectionEntry } from "astro:content";

import TagsList from "./TagsList";
import type { ReactNode } from "react";

export default function LogPreview({
  log,
  image,
}: {
  log: CollectionEntry<"log">;
  image?: ReactNode; // Make image prop optional
}) {
  const releaseDate = calculateRelativeDate(log.data.releaseDate);
  return (
    <article className="relative rounded-lg border border-gray-200 bg-card p-4 shadow-md sm:p-6">
      {image && image} {/* Only render image if it exists */}
      <div className="relative z-20">
        <div className="mb-5 flex flex-col items-center justify-between gap-1 sm:flex-row">
          <div className="inline-flex items-center overflow-auto rounded px-2 py-0.5 text-xs font-medium text-primary">
            <svg
              className="mr-1 h-3 w-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path>
            </svg>
            <div className="flex w-full overflow-x-auto">
              <TagsList tags={log.data.tags} />
            </div>
          </div>
          <span className="hidden text-xs text-muted-foreground sm:block sm:text-sm">
            {releaseDate < 0
              ? `releases in ${Math.abs(releaseDate)} days`
              : `released ${releaseDate} days ago`}
          </span>
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-primary underline-offset-4 hover:underline">
          <a href={"/dev-log/" + log.id}>{log.data.title}</a>
        </h2>
        <p className="mb-5 font-light text-muted-foreground">
          {log.data.description}
        </p>
        <div className="flex items-center justify-between text-xs font-medium text-primary ring-offset-background sm:text-sm">
          <a
            href={"/dev-log/" + log.id}
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
