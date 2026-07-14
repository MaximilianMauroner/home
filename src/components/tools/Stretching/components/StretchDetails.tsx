import { useState } from "react";
import type { Stretch } from "@/components/tools/Stretching/types";
import { PLACEHOLDER_IMAGE } from "../images";
import { StretchImage } from "./StretchImage";

interface StretchDetailsProps {
  stretch: Stretch;
}

export function StretchDetails({ stretch }: StretchDetailsProps) {
  const [showHow, setShowHow] = useState(true);
  const [showLookFor, setShowLookFor] = useState(true);

  return (
    <div className="space-y-4">
      {/* Stretch Image - Prominent Display */}
      <div className="relative overflow-hidden rounded-lg bg-muted shadow-sm">
        <StretchImage
          src={stretch.image || PLACEHOLDER_IMAGE}
          alt={stretch.name}
          className="h-64 w-full object-cover sm:h-80 md:h-96"
          fetchPriority="high"
          loading="eager"
          sizes="(min-width: 768px) 768px, calc(100vw - 2rem)"
        />
        {/* Soft overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Target areas tags */}
        {stretch.targetAreas && stretch.targetAreas.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            {stretch.targetAreas.map((area) => (
              <span
                key={area}
                className="rounded-full bg-white/25 px-3 py-1.5 text-sm font-medium text-white shadow-sm backdrop-blur-md"
              >
                {area}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* How To Section */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowHow(!showHow)}
          className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <svg
                className="h-5 w-5 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
            </div>
            <span className="font-semibold text-foreground">How to Do It</span>
          </div>
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform ${showHow ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showHow && (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="pl-13 whitespace-pre-line leading-relaxed text-muted-foreground">
              {stretch.how}
            </p>
          </div>
        )}
      </div>

      {/* What to Feel Section */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          onClick={() => setShowLookFor(!showLookFor)}
          className="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted/50 sm:p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10">
              <svg
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="font-semibold text-foreground">What to Feel</span>
          </div>
          <svg
            className={`h-5 w-5 text-muted-foreground transition-transform ${showLookFor ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {showLookFor && (
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="pl-13 whitespace-pre-line leading-relaxed text-muted-foreground">
              {stretch.lookFor}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
