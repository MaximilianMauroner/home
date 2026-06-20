import { Info } from "lucide-react";
import type { ReactNode } from "react";

interface ChartHeaderProps {
  title: ReactNode;
  assumption: string;
  className?: string;
}

export const ChartHeader = ({
  title,
  assumption,
  className = "",
}: ChartHeaderProps) => (
  <div className={`mb-2 flex items-center gap-2 sm:mb-4 ${className}`}>
    <h3 className="text-sm font-semibold sm:text-base">{title}</h3>
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Chart assumptions"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Info aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-md border bg-card px-3 py-2 text-xs font-normal leading-relaxed text-card-foreground opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {assumption}
      </span>
    </span>
  </div>
);
