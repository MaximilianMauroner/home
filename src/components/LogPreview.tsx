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
      className={`group relative h-full overflow-hidden border-2 ${scheme.border} ${scheme.borderHover} ${scheme.bg} ${scheme.bgHover} ${scheme.glow} shadow-xl backdrop-blur-sm transition-all duration-500 hover:shadow-2xl`}
      data-log-id={log.id}
      style={{
        fontFamily: 'monospace',
      }}
    >
      {/* Terminal scanlines effect - more prominent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.08) 1px, rgba(255,255,255,0.08) 2px)",
        }}
      />

      {/* Log file line number indicator on left - with ASCII decoration */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-10 border-r-2 ${scheme.border} opacity-50`}
        aria-hidden="true"
      >
        {/* Line numbers like in a text editor */}
        <div className="absolute top-4 left-0 right-0 flex flex-col items-center gap-1 font-mono text-[7px] opacity-60" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <div className={scheme.timestamp}>001</div>
          <div className={scheme.timestamp}>002</div>
          <div className={scheme.timestamp}>003</div>
        </div>
        {/* ASCII separator */}
        <div className={`absolute top-12 left-1 right-1 h-px ${scheme.border} opacity-30`} />
      </div>

      {/* Animated cursor blink effect - terminal style */}
      <div
        className={`absolute bottom-6 right-6 h-4 w-0.5 ${scheme.accent} animate-pulse opacity-90`}
        aria-hidden="true"
      />

      {/* Image overlay with better visibility */}
      {image && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.15] transition-opacity duration-500 group-hover:opacity-[0.25] dark:opacity-[0.08] dark:group-hover:opacity-[0.15]">
          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/40 to-transparent dark:from-black/70 dark:via-black/50" />
          {image}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col pl-14 pr-6 py-6 sm:py-8">
        {/* Terminal window title bar decoration */}
        <div className={`absolute top-0 left-10 right-0 h-4 border-b ${scheme.border} flex items-center gap-2 px-2 opacity-30`} aria-hidden="true">
          <div className={`w-1.5 h-1.5 rounded-full ${scheme.accent} opacity-50`} />
          <div className={`w-1.5 h-1.5 rounded-full ${scheme.text} opacity-30`} />
          <div className={`w-1.5 h-1.5 rounded-full ${scheme.text} opacity-30`} />
          <div className={`flex-1 font-mono text-[6px] ${scheme.text} text-center opacity-40`}>entry.log</div>
        </div>

        {/* Log file header - terminal style with ASCII art */}
        <div
          className={`mb-4 flex items-center gap-3 border-b-2 ${scheme.border} pb-2.5 mt-6`}
        >
          {/* ASCII decoration */}
          <span className={`font-mono text-xs ${scheme.text} opacity-30`}>┌─</span>
          {/* Log level badge - terminal style */}
          <div
            className={`px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest ${scheme.logLevel} border-2 ${scheme.border}`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            [INFO]
          </div>
          {/* ISO timestamp - log file format */}
          <div className={`flex-1 font-mono text-[10px] ${scheme.timestamp}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {new Date(log.data.releaseDate)
              .toISOString()
              .replace("T", " ")
              .substring(0, 19)}
          </div>
          {/* File indicator with ASCII */}
          <div className={`font-mono text-[8px] ${scheme.text} opacity-50`}>
            .log
          </div>
          <span className={`font-mono text-xs ${scheme.text} opacity-30`}>─┐</span>
        </div>

        {/* Tags */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TagsList tags={log.data.tags} />
        </div>

        {/* Title - log entry style with creative formatting */}
        <h2 className="mb-3 flex-1">
          <a
            href={"/dev-log/" + log.id}
            className={`block font-mono text-lg font-bold ${scheme.accent} leading-snug transition-all duration-300 hover:underline focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:text-xl`}
            data-astro-prefetch="hover"
            style={{ fontVariantNumeric: 'normal' }}
          >
            <span className="opacity-60 font-mono">$&gt;</span> <span className="opacity-70">cat</span> <span className="opacity-50">entry.log</span> <span className="opacity-60">|</span> <span className="opacity-70">grep</span> <span className="opacity-40">"{log.data.title.substring(0, 8)}"</span>
            <div className="mt-1 opacity-80">{log.data.title}</div>
          </a>
        </h2>

        {/* Description - log output style with ASCII */}
        <div className="mb-5 line-clamp-3">
          <p
            className={`font-mono text-xs ${scheme.text} leading-relaxed mb-2`}
            style={{ fontVariantNumeric: 'normal' }}
          >
            <span className="opacity-40">│</span> <span className="opacity-50">→</span> {log.data.description}
          </p>
          {/* ASCII separator line */}
          <div className={`font-mono text-[8px] ${scheme.text} opacity-20 mb-1`}>
            └─ ──────────────────────────────────────────────
          </div>
        </div>

        {/* Footer - log file style with ASCII decorations */}
        <div className="mt-auto border-t-2 border-gray-400 dark:border-gray-600 pt-3">
          {/* ASCII bottom border */}
          <div className={`font-mono text-[8px] ${scheme.text} opacity-20 mb-3`}>
            └──────────────────────────────────────────────────┘
          </div>
          
          <div className="flex items-center justify-between">
            <div className={`font-mono text-[10px] ${scheme.timestamp}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="opacity-60">~</span> <span className="opacity-40">$</span> <span className="opacity-50">date</span> <span className="opacity-60">-r</span> {timeAgo(log.data.releaseDate)}
            </div>

            {/* Read more - terminal command style with ASCII */}
            <a
              href={"/dev-log/" + log.id}
              className={`group/link inline-flex items-center gap-1.5 border-2 ${scheme.border} bg-gray-100 dark:bg-black/50 px-3 py-1.5 font-mono text-[10px] font-bold ${scheme.accent} transition-all duration-300 hover:gap-2 hover:bg-gray-200 dark:hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1`}
              style={{ fontVariantNumeric: 'normal' }}
            >
              <span className="opacity-70">$</span>
              <span className="opacity-80">tail</span>
              <span className="opacity-50">-f</span>
              <span className="opacity-60">entry.log</span>
              <span className={`font-mono text-xs ${scheme.text} opacity-40 transition-transform duration-300 group-hover/link:translate-x-0.5`}>▶</span>
            </a>
          </div>
        </div>
      </div>

      {/* Terminal glow effect on hover - CRT monitor style */}
      <div
        className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-15`}
        style={{
          boxShadow: `inset 0 0 60px ${scheme.text}40, 0 0 20px ${scheme.text}20`,
        }}
      />

      {/* Corner markers - ASCII box drawing characters */}
      <div
        className={`absolute top-0 left-0 font-mono text-xs ${scheme.text} opacity-30`}
        aria-hidden="true"
        style={{ lineHeight: 1 }}
      >
        ┌
      </div>
      <div
        className={`absolute top-0 right-0 font-mono text-xs ${scheme.text} opacity-30`}
        aria-hidden="true"
        style={{ lineHeight: 1 }}
      >
        ┐
      </div>
      <div
        className={`absolute bottom-0 left-0 font-mono text-xs ${scheme.text} opacity-30`}
        aria-hidden="true"
        style={{ lineHeight: 1 }}
      >
        └
      </div>
      <div
        className={`absolute bottom-0 right-0 font-mono text-xs ${scheme.text} opacity-30`}
        aria-hidden="true"
        style={{ lineHeight: 1 }}
      >
        ┘
      </div>

      {/* Terminal window decoration - side borders with ASCII */}
      <div className={`absolute left-0 top-4 bottom-4 w-px ${scheme.border} opacity-20`} aria-hidden="true" />
      <div className={`absolute right-0 top-4 bottom-4 w-px ${scheme.border} opacity-20`} aria-hidden="true" />
    </article>
  );
}
