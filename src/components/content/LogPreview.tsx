import type { CollectionEntry } from "astro:content";
import TagsList from "./TagsList";
import type { ReactNode } from "react";
import { timeAgo } from "@/utils/helpers";

export default function LogPreview({
  log,
  image,
}: {
  log: CollectionEntry<"log">;
  image?: ReactNode;
}) {
  // Check if we have an image path but no ReactNode image
  // This happens when used in React components like TagView
  const hasImagePath = log.data.image && log.data.image.trim() !== "";

  // High contrast color schemes for WCAG AA compliance in both light and dark modes
  // Use entry ID to determine color scheme - this ensures consistency with the detail page
  // The entry ID format should match what's in the URL (e.g., "2025/17" or "2025-17")
  const entryId = log.id.split("/").filter(Boolean)[1];
  const colorSchemeIndex =
    entryId.length > 1 ? entryId.charCodeAt(1) % 5 : entryId.charCodeAt(0) % 5;
  const logSchemes = [
    {
      name: "matrix",
      bg: "bg-gradient-to-br from-white dark:from-black via-green-50 dark:via-green-950/30 to-gray-50 dark:to-black",
      bgHover: "group-hover:via-green-100 dark:group-hover:via-green-950/50",
      text: "text-green-700 dark:text-green-300", // High contrast: green-700 on white (7:1), green-300 on black (12:1)
      accent: "text-green-600 dark:text-green-200", // Accent colors with good contrast
      border: "border-green-600/80 dark:border-green-400/60", // Stronger borders for better visibility
      borderHover:
        "group-hover:border-green-700 dark:group-hover:border-green-400",
      timestamp: "text-green-700/95 dark:text-green-300/95", // Nearly full opacity for readability
      logLevel:
        "bg-green-100 dark:bg-green-500/30 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-500/50", // Badge with better contrast
      glow: "group-hover:shadow-[0_0_40px_rgba(34,197,94,0.3)] dark:group-hover:shadow-[0_0_40px_rgba(74,222,128,0.4)]",
    },
    {
      name: "amber",
      bg: "bg-gradient-to-br from-white dark:from-zinc-950 via-amber-50 dark:via-amber-950/30 to-gray-50 dark:to-zinc-950",
      bgHover: "group-hover:via-amber-100 dark:group-hover:via-amber-950/50",
      text: "text-amber-800 dark:text-amber-300",
      accent: "text-amber-700 dark:text-amber-200",
      border: "border-amber-600/80 dark:border-amber-400/60",
      borderHover:
        "group-hover:border-amber-700 dark:group-hover:border-amber-400",
      timestamp: "text-amber-800/95 dark:text-amber-300/95",
      logLevel:
        "bg-amber-100 dark:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-500/50",
      glow: "group-hover:shadow-[0_0_40px_rgba(245,158,11,0.3)] dark:group-hover:shadow-[0_0_40px_rgba(251,191,36,0.4)]",
    },
    {
      name: "cyan",
      bg: "bg-gradient-to-br from-white dark:from-slate-950 via-cyan-50 dark:via-cyan-950/30 to-gray-50 dark:to-slate-950",
      bgHover: "group-hover:via-cyan-100 dark:group-hover:via-cyan-950/50",
      text: "text-cyan-800 dark:text-cyan-300",
      accent: "text-cyan-700 dark:text-cyan-200",
      border: "border-cyan-600/80 dark:border-cyan-400/60",
      borderHover:
        "group-hover:border-cyan-700 dark:group-hover:border-cyan-400",
      timestamp: "text-cyan-800/95 dark:text-cyan-300/95",
      logLevel:
        "bg-cyan-100 dark:bg-cyan-500/30 text-cyan-900 dark:text-cyan-200 border border-cyan-300 dark:border-cyan-500/50",
      glow: "group-hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] dark:group-hover:shadow-[0_0_40px_rgba(34,211,238,0.4)]",
    },
    {
      name: "purple",
      bg: "bg-gradient-to-br from-white dark:from-indigo-950 via-purple-50 dark:via-purple-950/30 to-gray-50 dark:to-indigo-950",
      bgHover: "group-hover:via-purple-100 dark:group-hover:via-purple-950/50",
      text: "text-purple-800 dark:text-purple-300",
      accent: "text-purple-700 dark:text-purple-200",
      border: "border-purple-600/80 dark:border-purple-400/60",
      borderHover:
        "group-hover:border-purple-700 dark:group-hover:border-purple-400",
      timestamp: "text-purple-800/95 dark:text-purple-300/95",
      logLevel:
        "bg-purple-100 dark:bg-purple-500/30 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-500/50",
      glow: "group-hover:shadow-[0_0_40px_rgba(168,85,247,0.3)] dark:group-hover:shadow-[0_0_40px_rgba(192,132,252,0.4)]",
    },
    {
      name: "rose",
      bg: "bg-gradient-to-br from-white dark:from-rose-950 via-rose-50 dark:via-rose-950/30 to-gray-50 dark:to-rose-950",
      bgHover: "group-hover:via-rose-100 dark:group-hover:via-rose-950/50",
      text: "text-rose-800 dark:text-rose-300",
      accent: "text-rose-700 dark:text-rose-200",
      border: "border-rose-600/80 dark:border-rose-400/60",
      borderHover:
        "group-hover:border-rose-700 dark:group-hover:border-rose-400",
      timestamp: "text-rose-800/95 dark:text-rose-300/95",
      logLevel:
        "bg-rose-100 dark:bg-rose-500/30 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-500/50",
      glow: "group-hover:shadow-[0_0_40px_rgba(244,63,94,0.3)] dark:group-hover:shadow-[0_0_40px_rgba(251,113,133,0.4)]",
    },
  ];
  const scheme = logSchemes[colorSchemeIndex];
  return (
    <article
      className={`group relative h-full overflow-hidden border ${scheme.border} ${scheme.borderHover} ${scheme.bg} ${scheme.bgHover} ${scheme.glow} shadow-lg transition-all duration-300 hover:shadow-2xl`}
      data-log-id={log.id}
    >
      {/* Image overlay */}
      {(image || hasImagePath) && (
        <div className="pointer-events-none absolute inset-0 opacity-15 transition-opacity duration-300 group-hover:opacity-25 dark:opacity-10 dark:group-hover:opacity-15">
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent dark:from-black/70 dark:via-black/50" />
          {image ? (
            image
          ) : hasImagePath && log.data.image ? (
            <img
              src={log.data.image}
              alt={log.data.title}
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-6 sm:p-8">
        {/* Header */}
        <div
          className={`mb-4 flex items-center gap-3 border-b ${scheme.border} pb-3`}
        >
          <div
            className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${scheme.logLevel}`}
          >
            INFO
          </div>
          <div className={`text-xs ${scheme.timestamp}`}>
            {new Date(log.data.releaseDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-4">
          <TagsList tags={log.data.tags} />
        </div>

        {/* Title */}
        <h2 className="mb-3 flex-1">
          <a
            href={"/dev-log/" + log.id + "/"}
            className={`block text-xl font-bold ${scheme.accent} leading-tight transition-all duration-200 hover:underline sm:text-2xl`}
            data-astro-prefetch="hover"
          >
            {log.data.title}
          </a>
        </h2>

        {/* Description */}
        <div className="mb-6 line-clamp-3">
          <p className={`text-sm ${scheme.text} leading-relaxed`}>
            {log.data.description}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-300/50 pt-4 dark:border-gray-700/50">
          <div className={`text-sm ${scheme.timestamp}`}>
            {timeAgo(log.data.releaseDate)}
          </div>

          <a
            href={"/dev-log/" + log.id + "/"}
            className={`group/link inline-flex items-center gap-2 border ${scheme.border} bg-white/50 px-4 py-2 text-sm font-medium dark:bg-black/30 ${scheme.accent} transition-all duration-200 hover:gap-3 hover:bg-white/80 dark:hover:bg-black/50`}
          >
            Read more
            <span className="transition-transform duration-200 group-hover/link:translate-x-0.5">
              →
            </span>
          </a>
        </div>
      </div>
    </article>
  );
}
