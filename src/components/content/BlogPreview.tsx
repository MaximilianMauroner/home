import type { CollectionEntry } from "astro:content";
import TagsList from "./TagsList";
import type { ReactNode } from "react";
import { timeAgo } from "@/utils/helpers";

export default function BlogPreview({
  blog,
  image,
}: {
  blog: CollectionEntry<"blog"> & { _imageUrl?: string };
  image?: ReactNode;
}) {
  const hasImagePath = blog.data.image && blog.data.image.trim() !== "";

  const colorSchemeIndex =
    parseInt(blog.id.split("-").filter(Boolean)[0]) % 6 || 0;

  const schemes = [
    {
      gradient: "from-violet-500/20 via-purple-500/20 to-fuchsia-500/20",
      darkGradient:
        "dark:from-violet-500/30 dark:via-purple-500/30 dark:to-fuchsia-500/30",
      accent: "text-violet-600 dark:text-violet-400",
      borderGradient: "from-violet-500/50 to-purple-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(139,92,246,0.3)]",
    },
    {
      gradient: "from-blue-500/20 via-cyan-500/20 to-teal-500/20",
      darkGradient:
        "dark:from-blue-500/30 dark:via-cyan-500/30 dark:to-teal-500/30",
      accent: "text-blue-600 dark:text-blue-400",
      borderGradient: "from-blue-500/50 to-cyan-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]",
    },
    {
      gradient: "from-emerald-500/20 via-green-500/20 to-teal-500/20",
      darkGradient:
        "dark:from-emerald-500/30 dark:via-green-500/30 dark:to-teal-500/30",
      accent: "text-emerald-600 dark:text-emerald-400",
      borderGradient: "from-emerald-500/50 to-green-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]",
    },
    {
      gradient: "from-rose-500/20 via-pink-500/20 to-fuchsia-500/20",
      darkGradient:
        "dark:from-rose-500/30 dark:via-pink-500/30 dark:to-fuchsia-500/30",
      accent: "text-rose-600 dark:text-rose-400",
      borderGradient: "from-rose-500/50 to-pink-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(244,63,94,0.3)]",
    },
    {
      gradient: "from-amber-500/20 via-orange-500/20 to-red-500/20",
      darkGradient:
        "dark:from-amber-500/30 dark:via-orange-500/30 dark:to-red-500/30",
      accent: "text-amber-600 dark:text-amber-400",
      borderGradient: "from-amber-500/50 to-orange-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]",
    },
    {
      gradient: "from-indigo-500/20 via-blue-500/20 to-purple-500/20",
      darkGradient:
        "dark:from-indigo-500/30 dark:via-blue-500/30 dark:to-purple-500/30",
      accent: "text-indigo-600 dark:text-indigo-400",
      borderGradient: "from-indigo-500/50 to-blue-500/50",
      glow: "group-hover:shadow-[0_0_30px_rgba(99,102,241,0.3)]",
    },
  ];
  const scheme = schemes[colorSchemeIndex];

  // Subtle tilt for visual interest
  const tilt = Math.sin(colorSchemeIndex) * 1.5;

  return (
    <article
      className={`group relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl transition-all duration-700 hover:scale-[1.02] hover:border-opacity-100 ${scheme.glow}`}
      style={{
        transform: `perspective(1000px) rotateX(${tilt * 0.1}deg) rotateY(${tilt * 0.2}deg)`,
      }}
    >
      {/* Animated gradient background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${scheme.gradient} ${scheme.darkGradient} opacity-50 transition-opacity duration-700 group-hover:opacity-70`}
        style={{
          backgroundSize: "200% 200%",
          animation: "animated-background 15s ease infinite",
        }}
      />

      {/* Image overlay with parallax effect */}
      {(image || hasImagePath) && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20 transition-opacity duration-700 group-hover:opacity-30 dark:opacity-10 dark:group-hover:opacity-20">
          <div className="absolute inset-0 scale-110 transition-transform duration-700 group-hover:scale-100">
            {image ? (
              image
            ) : hasImagePath && blog._imageUrl ? (
              <img
                src={blog._imageUrl}
                alt={blog.data.title}
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-card/60 via-card/40 to-transparent" />
        </div>
      )}

      {/* Decorative grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Animated border gradient */}
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${scheme.borderGradient} -z-10 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100`}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        {/* Tags */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TagsList tags={blog.data.tags} />
        </div>

        {/* Date */}
        <div
          className={`mb-3 text-xs font-medium ${scheme.accent} uppercase tracking-wider`}
        >
          {new Date(blog.data.releaseDate).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>

        {/* Title */}
        <h2 className="mb-4 flex-1">
          <a
            href={`/blog/${blog.id}/`}
            className="text-2xl font-bold leading-tight text-foreground transition-colors duration-300 hover:text-primary sm:text-3xl"
            data-astro-prefetch="hover"
          >
            {blog.data.title}
          </a>
        </h2>

        {/* Description */}
        <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {blog.data.description}
        </p>

        {/* Footer with time ago and read more */}
        <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-4">
          <div className="flex items-center gap-2">
            <div
              className={`text-xs font-medium ${scheme.accent} flex items-center gap-1.5`}
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {timeAgo(blog.data.releaseDate)}
            </div>
          </div>

          <a
            href={`/blog/${blog.id}/`}
            className={`group/link inline-flex items-center gap-2 ${scheme.accent} transition-all duration-300 hover:gap-3`}
            data-astro-prefetch="hover"
          >
            <span className="text-sm font-semibold">Read more</span>
            <svg
              className="h-4 w-4 transition-transform duration-300 group-hover/link:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Shine effect on hover */}
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
    </article>
  );
}
