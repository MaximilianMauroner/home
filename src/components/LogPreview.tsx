import { calculateRelativeDate } from "@/utils/helpers";
import type { CollectionEntry } from "astro:content";

import TagsList from "./TagsList";
import type { ReactNode } from "react";
import { timeAgo } from "@/utils/helpers";

export default function LogPreview({
  log,
  image,
}: {
  log: CollectionEntry<"log">;
  image?: ReactNode; // Make image prop optional
}) {
  // Creative log file color schemes - terminal/console inspired
  const colorSchemeIndex = log.id.charCodeAt(1) % 5;
  const logSchemes = [
    { 
      name: "matrix", 
      bg: "bg-black", 
      text: "text-green-300", 
      accent: "text-green-200",
      border: "border-green-400/40",
      timestamp: "text-green-300",
      logLevel: "bg-green-400/25 text-green-200"
    },
    { 
      name: "amber", 
      bg: "bg-zinc-900", 
      text: "text-amber-300", 
      accent: "text-amber-200",
      border: "border-amber-400/40",
      timestamp: "text-amber-300",
      logLevel: "bg-amber-400/25 text-amber-200"
    },
    { 
      name: "cyan", 
      bg: "bg-slate-950", 
      text: "text-cyan-300", 
      accent: "text-cyan-200",
      border: "border-cyan-400/40",
      timestamp: "text-cyan-300",
      logLevel: "bg-cyan-400/25 text-cyan-200"
    },
    { 
      name: "purple", 
      bg: "bg-indigo-950", 
      text: "text-purple-300", 
      accent: "text-purple-200",
      border: "border-purple-400/40",
      timestamp: "text-purple-300",
      logLevel: "bg-purple-400/25 text-purple-200"
    },
    { 
      name: "rose", 
      bg: "bg-rose-950", 
      text: "text-rose-300", 
      accent: "text-rose-200",
      border: "border-rose-400/40",
      timestamp: "text-rose-300",
      logLevel: "bg-rose-400/25 text-rose-200"
    },
  ];
  const scheme = logSchemes[colorSchemeIndex];
  
  // Generate pseudo log lines
  const logLines = [
    `[${new Date(log.data.releaseDate).toLocaleTimeString('en-US', { hour12: false })}] INFO: ${log.data.title.substring(0, 20)}...`,
    `[${new Date(log.data.releaseDate).toLocaleTimeString('en-US', { hour12: false })}] DEBUG: Processing entry...`,
  ];

  return (
    <article className={`group relative h-full overflow-hidden rounded border-2 ${scheme.border} ${scheme.bg} p-4 shadow-2xl transition-all duration-500 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] dark:border-gray-800 sm:p-5`}>
      {/* Log file binding effect - left side */}
      <div className={`absolute left-0 top-0 h-full w-3 ${scheme.bg} border-r-2 ${scheme.border} opacity-80`} />
      
      {/* Terminal scanlines effect */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)",
      }} />
      
      {/* Cursor blink effect */}
      <div className={`absolute right-4 bottom-4 h-4 w-0.5 ${scheme.text} opacity-80 animate-pulse`} />
      
      {/* Log file header */}
      <div className={`mb-3 flex items-center gap-2 border-b ${scheme.border} pb-2`}>
        <div className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-bold ${scheme.logLevel}`}>
          INFO
        </div>
        <div className={`flex-1 font-mono text-[10px] ${scheme.timestamp}`} style={{ opacity: 0.85 }}>
          {new Date(log.data.releaseDate).toISOString().replace('T', ' ').substring(0, 19)}
        </div>
      </div>
      
      {/* Fake log lines in background */}
      <div className="absolute left-6 top-16 right-4 opacity-20 pointer-events-none">
        {logLines.map((line, idx) => (
          <div key={idx} className={`mb-1 font-mono text-[9px] ${scheme.text} opacity-50`}>
            {line}
          </div>
        ))}
      </div>
      
      {image && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.02]">
          {image}
        </div>
      )}
      
      <div className="relative z-20 pl-6 pr-2">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <TagsList tags={log.data.tags} />
        </div>

        {/* Title as log entry */}
        <h2 className={`mb-3 font-mono text-lg font-bold ${scheme.accent} leading-tight transition-all duration-300 sm:text-xl ${
          colorSchemeIndex === 0 ? 'group-hover:text-green-200' :
          colorSchemeIndex === 1 ? 'group-hover:text-amber-200' :
          colorSchemeIndex === 2 ? 'group-hover:text-cyan-200' :
          colorSchemeIndex === 3 ? 'group-hover:text-purple-200' :
          'group-hover:text-rose-200'
        }`}>
          <a href={"/dev-log/" + log.id} className="hover:underline">
            {`> ${log.data.title}`}
          </a>
        </h2>
        
        {/* Description as log content */}
        <p className={`mb-5 font-mono text-xs ${scheme.text} leading-relaxed`} style={{ opacity: 0.95 }}>
          {log.data.description}
        </p>
        
        {/* Timestamp badge */}
        <div className={`mb-4 inline-block rounded border ${scheme.border} bg-black/50 px-2 py-1 font-mono text-[10px] ${scheme.timestamp} backdrop-blur-sm`} style={{ opacity: 0.95 }}>
          {timeAgo(log.data.releaseDate)}
        </div>
        
        {/* Read more as log command */}
        <div className="flex items-center justify-between">
          <a
            href={"/dev-log/" + log.id}
            className={`inline-flex items-center gap-2 rounded border ${scheme.border} bg-black/50 px-3 py-1.5 font-mono text-xs font-semibold ${scheme.accent} backdrop-blur-sm transition-all duration-300 hover:bg-black/70 hover:gap-3 sm:text-sm`}
            style={{ opacity: 0.95 }}
          >
            <span>tail -f entry.log</span>
            <svg
              className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      </div>
      
      {/* Terminal glow effect on hover */}
      <div className={`absolute inset-0 ${scheme.bg} opacity-0 transition-opacity duration-500 group-hover:opacity-50`} style={{
        boxShadow: `inset 0 0 60px ${scheme.text}40`,
      }} />
    </article>
  );
}
