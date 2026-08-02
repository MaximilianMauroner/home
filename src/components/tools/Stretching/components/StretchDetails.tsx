import type { Stretch } from "@/components/tools/Stretching/types";
import { PLACEHOLDER_IMAGE } from "../images";
import { StretchImage } from "./StretchImage";

interface StretchDetailsProps {
  stretch: Stretch;
  section?: "all" | "image" | "guidance";
}

export function StretchDetails({
  stretch,
  section = "all",
}: StretchDetailsProps) {
  const showImage = section === "all" || section === "image";
  const showGuidance = section === "all" || section === "guidance";
  return (
    <div className="space-y-4">
      {showImage && (
        <div className="stretching-image-surface relative h-[13rem] shadow-sm sm:h-80 lg:h-[36rem]">
          <StretchImage
            src={stretch.image || PLACEHOLDER_IMAGE}
            alt={stretch.name}
            className="h-full w-full object-cover"
            fetchPriority="high"
            loading="eager"
            sizes="(min-width: 1024px) 40vw, calc(100vw - 2rem)"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          {stretch.targetAreas && stretch.targetAreas.length > 0 && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-1.5">
              {stretch.targetAreas.slice(0, 3).map((area) => (
                <span
                  key={area}
                  className="rounded-full bg-black/35 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md sm:text-sm"
                >
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {showGuidance && (
        <div className="grid gap-3 sm:grid-cols-2">
          <details className="group overflow-hidden rounded-xl border border-border bg-card">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between px-4 font-semibold text-foreground transition-colors hover:bg-muted/50">
              How to do it
              <span
                aria-hidden="true"
                className="text-xl text-muted-foreground group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="whitespace-pre-line px-4 pb-4 leading-relaxed text-muted-foreground">
              {stretch.how}
            </p>
          </details>
          <details className="group overflow-hidden rounded-xl border border-border bg-card">
            <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between px-4 font-semibold text-foreground transition-colors hover:bg-muted/50">
              What to feel
              <span
                aria-hidden="true"
                className="text-xl text-muted-foreground group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="whitespace-pre-line px-4 pb-4 leading-relaxed text-muted-foreground">
              {stretch.lookFor}
            </p>
          </details>
        </div>
      )}
    </div>
  );
}
