import type { CollectionEntry } from "astro:content";
import TagsList from "./TagsList";
import type { ReactNode } from "react";
import { timeAgo } from "@/utils/helpers";

export default function SnackPreview({
  snack,
  image,
}: {
  snack: CollectionEntry<"snacks">;
  image?: ReactNode; // Make image prop optional
}) {
  // Generate organic variations based on ID for more personality
  const rotation = Math.sin(snack.id.charCodeAt(0)) * 4.5; // -4.5 to 4.5 degrees
  const skewX = Math.cos(snack.id.charCodeAt(1)) * 0.8; // more skew variation
  const scale = 0.96 + Math.abs(Math.sin(snack.id.charCodeAt(2))) * 0.06; // more size variation
  const offsetX = Math.sin(snack.id.charCodeAt(3)) * 3;
  const offsetY = Math.cos(snack.id.charCodeAt(4)) * 3;

  return (
    <article
      className="group relative h-full w-full"
      style={{
        transform: `rotate(${rotation}deg) skewX(${skewX}deg) scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
        transformOrigin: "center",
      }}
    >
      {/* Irregular paper scrap shape - more torn/ripped */}
      <div className="relative h-full overflow-visible">
        {/* Main paper shape - highly irregular torn edges */}
        <div
          className="relative h-full bg-gradient-to-br from-white via-yellow-50 to-amber-100 p-5 pb-4 shadow-[3px_4px_12px_rgba(0,0,0,0.18),_-2px_-2px_6px_rgba(255,255,255,0.9)] transition-all duration-500 group-hover:shadow-[5px_6px_18px_rgba(0,0,0,0.22),_-3px_-3px_8px_rgba(255,255,255,0.95)] sm:p-6 sm:pb-5 dark:from-gray-900 dark:via-yellow-950 dark:to-amber-950 dark:shadow-[3px_4px_12px_rgba(0,0,0,0.6)] dark:group-hover:shadow-[5px_6px_18px_rgba(0,0,0,0.7)]"
          style={{
            clipPath: `polygon(
              1% 4%, 7% 0.5%, 14% 2%, 21% 0%, 29% 2%, 36% 0.5%, 
              43% 1.5%, 51% 0%, 59% 2.5%, 66% 0.5%, 73% 3.5%, 81% 1%, 
              88% 2%, 95% 5%, 99% 9%, 98% 16%, 99% 23%, 97% 31%, 
              99% 39%, 98% 46%, 99% 54%, 97% 61%, 99% 69%, 98% 76%, 
              97% 83%, 99% 91%, 95% 98%, 89% 99%, 81% 97%, 74% 99%, 
              67% 96%, 59% 99%, 52% 97%, 44% 99%, 37% 96%, 29% 99%, 
              22% 97%, 14% 99%, 7% 96%, 2% 94%, 0% 89%, 0% 81%, 
              1% 74%, 0% 67%, 1% 59%, 0% 51%, 1% 44%, 0% 36%, 
              1% 29%, 0% 21%, 1% 14%, 0% 7%
            )`,
          }}
        >
          {/* Pattern background - very subtle */}
          {image && (
            <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
              {image}
            </div>
          )}

          {/* Multiple handwritten scribbles - more scattered */}
          <div className="pointer-events-none absolute right-2 top-2 opacity-25 dark:opacity-15">
            <svg
              width="35"
              height="35"
              viewBox="0 0 40 40"
              className="text-amber-700 dark:text-amber-500"
            >
              <path
                d="M 4,8 Q 9,4 14,7 T 24,5 Q 29,7 34,4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M 6,22 Q 10,18 16,21 T 26,18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="dark:opacity-12 pointer-events-none absolute bottom-4 left-3 opacity-20">
            <svg
              width="25"
              height="25"
              viewBox="0 0 40 40"
              className="text-orange-600 dark:text-orange-400"
            >
              <path
                d="M 10,5 Q 15,8 20,6 T 30,8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Torn corner effect - more pronounced */}
          <div
            className="absolute -bottom-2 -right-2 h-10 w-10 bg-gradient-to-br from-amber-300/50 to-transparent dark:from-amber-700/30"
            style={{ clipPath: "polygon(0% 0%, 100% 100%, 0% 100%)" }}
          />
          <div
            className="absolute -bottom-2 -right-2 h-10 w-10 border-b-[3px] border-r-[3px] border-amber-400/40 dark:border-amber-600/30"
            style={{ clipPath: "polygon(0% 0%, 100% 100%, 0% 100%)" }}
          />

          {/* Coffee stain / ink blot */}
          <div className="bg-amber-700/8 absolute left-1/4 top-1/4 h-8 w-8 rounded-full blur-md dark:bg-amber-500/10" />
          <div className="bg-orange-600/6 dark:bg-orange-500/8 absolute bottom-1/3 right-1/4 h-6 w-6 rounded-full blur-sm" />

          <div className="relative z-20">
            {/* Tags - more scattered, playful */}
            <div className="mb-3 flex flex-wrap items-start gap-1.5">
              <TagsList tags={snack.data.tags} />
            </div>

            {/* Title - high contrast, whimsical */}
            <h2 className="mb-3">
              <a
                href={`/snacks/${snack.id}/`}
                className="block font-serif text-xl font-semibold italic text-gray-900 transition-all hover:text-amber-800 sm:text-2xl dark:text-gray-50 dark:hover:text-amber-200"
                style={{
                  textShadow:
                    "1px 1px 2px rgba(0,0,0,0.1), 0 0 2px rgba(255,255,255,0.8)",
                  letterSpacing: "0.04em",
                  lineHeight: "1.35",
                }}
              >
                {snack.data.title}
              </a>
            </h2>

            {/* Description - high contrast text */}
            <p
              className="mb-4 font-serif text-xs italic leading-relaxed text-gray-800 sm:text-sm dark:text-gray-200"
              style={{
                letterSpacing: "0.015em",
                fontWeight: 400,
              }}
            >
              {snack.data.description}
            </p>

            {/* Time - more visible but still playful */}
            <div className="mb-3 text-[10px] font-medium italic text-amber-800/70 sm:text-xs dark:text-amber-300/80">
              {timeAgo(snack.data.releaseDate)}
            </div>

            {/* Link - whimsical with high contrast */}
            <div className="mt-auto">
              <a
                href={`/snacks/${snack.id}/`}
                className="group/link inline-flex items-center gap-1.5 text-xs font-medium text-gray-900 transition-all hover:text-amber-800 dark:text-gray-100 dark:hover:text-amber-200"
                style={{ fontStyle: "italic" }}
              >
                <span>see more →</span>
              </a>
            </div>
          </div>

          {/* Hover glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-100/0 via-orange-100/0 to-yellow-100/0 opacity-0 transition-opacity duration-500 group-hover:opacity-40 dark:from-amber-900/0 dark:via-orange-900/0 dark:to-yellow-900/0 dark:group-hover:opacity-20" />
        </div>

        {/* Multiple layered shadows for depth */}
        <div
          className="absolute inset-0 -z-20 bg-amber-900/15 blur-2xl transition-all duration-500 group-hover:bg-amber-900/25 group-hover:blur-3xl dark:bg-amber-900/30 dark:group-hover:bg-amber-900/40"
          style={{
            transform: `translateY(6px) translateX(${Math.sin(snack.id.charCodeAt(0)) * 3}px) rotate(${rotation * 0.5}deg)`,
          }}
        />
        <div
          className="absolute inset-0 -z-10 bg-orange-900/10 blur-xl transition-all duration-500 group-hover:bg-orange-900/20 group-hover:blur-2xl dark:bg-orange-900/20 dark:group-hover:bg-orange-900/30"
          style={{
            transform: `translateY(3px) translateX(${Math.cos(snack.id.charCodeAt(1)) * 2}px) rotate(${rotation * 0.3}deg)`,
          }}
        />
      </div>
    </article>
  );
}
