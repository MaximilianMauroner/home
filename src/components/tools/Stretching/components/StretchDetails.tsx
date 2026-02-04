import { useState } from "react";
import type { Stretch } from "@/components/tools/Stretching/types";
import { PLACEHOLDER_IMAGE } from "../images";

interface StretchDetailsProps {
  stretch: Stretch;
}

export function StretchDetails({ stretch }: StretchDetailsProps) {
  const [showHow, setShowHow] = useState(true);
  const [showLookFor, setShowLookFor] = useState(true);

  return (
    <div className="space-y-4">
      {/* Stretch Image - Prominent Display */}
      <div className="relative rounded-2xl overflow-hidden bg-muted shadow-lg">
        <img
          src={stretch.image || PLACEHOLDER_IMAGE}
          alt={stretch.name}
          className="w-full h-64 sm:h-80 md:h-96 object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
          }}
        />
        {/* Soft overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Target areas tags */}
        {stretch.targetAreas && stretch.targetAreas.length > 0 && (
          <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
            {stretch.targetAreas.map((area) => (
              <span
                key={area}
                className="text-sm font-medium text-white bg-white/25 backdrop-blur-md px-3 py-1.5 rounded-full shadow-sm"
              >
                {area}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* How To Section */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setShowHow(!showHow)}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">How to Do It</span>
          </div>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform ${showHow ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showHow && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line pl-13">
              {stretch.how}
            </p>
          </div>
        )}
      </div>

      {/* What to Feel Section */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button
          onClick={() => setShowLookFor(!showLookFor)}
          className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">What to Feel</span>
          </div>
          <svg
            className={`w-5 h-5 text-muted-foreground transition-transform ${showLookFor ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showLookFor && (
          <div className="px-4 sm:px-5 pb-4 sm:pb-5">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line pl-13">
              {stretch.lookFor}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
