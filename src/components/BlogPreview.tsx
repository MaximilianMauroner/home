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
  // Generate paper variations based on ID
  const paperVariation = blog.id.charCodeAt(1) % 3;
  const paperTypes = [
    { bg: "bg-stone-50", darkBg: "dark:bg-amber-950/30", border: "border-amber-200", line: "border-blue-200/40", margin: "bg-blue-100/20" },
    { bg: "bg-amber-50", darkBg: "dark:bg-yellow-950/20", border: "border-yellow-200", line: "border-red-200/40", margin: "bg-red-100/20" },
    { bg: "bg-yellow-50", darkBg: "dark:bg-orange-950/30", border: "border-orange-200", line: "border-purple-200/40", margin: "bg-purple-100/20" },
  ];
  const paper = paperTypes[paperVariation];
  
  // Subtle rotation for organic feel
  const rotation = Math.sin(blog.id.charCodeAt(0)) * 0.5;

  return (
    <article 
      className={`group relative h-full overflow-hidden rounded-sm border ${paper.border} ${paper.bg} ${paper.darkBg} p-5 shadow-[2px_4px_8px_rgba(0,0,0,0.15),_-1px_-1px_2px_rgba(255,255,255,0.8)] transition-all duration-500 hover:shadow-[4px_6px_12px_rgba(0,0,0,0.2),_-2px_-2px_4px_rgba(255,255,255,0.9)] hover:rotate-0 dark:border-gray-700/50 dark:shadow-[2px_4px_8px_rgba(0,0,0,0.4)] dark:hover:shadow-[4px_6px_12px_rgba(0,0,0,0.5)] sm:p-6`}
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: 'center',
      }}
    >
      {/* Paper texture - subtle grain */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'4\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
      }} />
      
      {/* Lined paper effect - horizontal lines */}
      <div className={`absolute left-0 top-0 h-full w-full opacity-30 dark:opacity-20`} style={{
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 24px, currentColor 24px, currentColor 25px)',
        backgroundSize: '100% 25px',
      }} />
      
      {/* Red margin line (like notebook) */}
      <div className={`absolute left-10 top-0 h-full w-0.5 ${paper.margin} dark:opacity-30`} />
      
      {/* Paper fold shadow at top */}
      <div className="absolute left-0 top-0 h-2 w-full bg-gradient-to-b from-gray-300/20 to-transparent dark:from-gray-700/30" />
      
      {/* Ink spots/paper imperfections */}
      <div className="absolute right-8 top-12 h-2 w-2 rounded-full bg-gray-400/10 dark:bg-gray-500/20" />
      <div className="absolute bottom-16 left-6 h-1.5 w-1.5 rounded-full bg-gray-400/10 dark:bg-gray-500/20" />
      
      {/* Notebook binding holes */}
      <div className="absolute left-1 top-12 h-2 w-2 rounded-full border border-gray-300/40 dark:border-gray-600/40" />
      <div className="absolute left-1 top-24 h-2 w-2 rounded-full border border-gray-300/40 dark:border-gray-600/40" />
      <div className="absolute left-1 top-36 h-2 w-2 rounded-full border border-gray-300/40 dark:border-gray-600/40" />
      
      {image && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] transition-opacity duration-500 group-hover:opacity-[0.06] dark:opacity-[0.06] dark:group-hover:opacity-[0.08]">
          {image}
        </div>
      )}
      
      <div className="relative z-20 pl-12 pr-2">
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <TagsList tags={blog.data.tags} />
        </div>
        
        {/* Date written like journal entry */}
        <div className="mb-3 font-serif text-[10px] italic text-muted-foreground/70 sm:text-xs">
          {new Date(blog.data.releaseDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        
        {/* Title - handwritten style */}
        <h2 className="mb-4 font-serif text-2xl font-bold tracking-wide text-primary underline-offset-4 transition-all duration-300 group-hover:text-gray-800 dark:group-hover:text-gray-100 sm:text-3xl">
          <a href={`/blog/${blog.id}/`} className="hover:underline">{blog.data.title}</a>
        </h2>
        
        {/* Description - journal entry text */}
        <p className="mb-6 font-serif text-sm leading-relaxed text-gray-700 dark:text-gray-300 sm:text-base">
          {blog.data.description}
        </p>
        
        {/* Time ago badge */}
        <div className="mb-4 inline-block rounded-sm border border-gray-300/50 bg-white/60 px-2.5 py-1 font-serif text-[10px] italic text-gray-600 backdrop-blur-sm dark:border-gray-600/50 dark:bg-gray-800/40 dark:text-gray-400 sm:text-xs">
          {timeAgo(blog.data.releaseDate)}
        </div>
        
        {/* Read more link - like underlined text */}
        <div className="flex items-center justify-between">
          <a
            href={`/blog/${blog.id}/`}
            className="inline-flex items-center gap-2 border-b border-dashed border-gray-400/50 px-1 font-serif text-xs italic text-gray-700 transition-all duration-300 hover:border-solid hover:text-gray-900 dark:border-gray-500/50 dark:text-gray-300 dark:hover:text-gray-100 sm:text-sm"
          >
            <span>Continue reading...</span>
            <svg
              className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </div>
      
      {/* Paper lift shadow on hover */}
      <div className="absolute inset-0 rounded-sm bg-gradient-to-br from-gray-200/0 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-30 dark:from-gray-800/0" />
    </article>
  );
}
