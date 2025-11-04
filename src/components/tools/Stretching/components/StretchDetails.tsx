import type { Stretch } from "../types";

interface StretchDetailsProps {
  stretch: Stretch;
}

export function StretchDetails({ stretch }: StretchDetailsProps) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent rounded-2xl p-4 sm:p-6 border border-blue-500/20 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <span className="text-lg sm:text-xl">📋</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg mb-1 text-foreground">What to Do</h3>
          </div>
        </div>
        <div className="pl-0 sm:pl-12">
          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line">
            {stretch.how}
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent rounded-2xl p-4 sm:p-6 border border-green-500/20 shadow-sm">
        <div className="flex items-start gap-3 mb-3">
          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <span className="text-lg sm:text-xl">✨</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg mb-1 text-foreground">What to Feel</h3>
          </div>
        </div>
        <div className="pl-0 sm:pl-12">
          <p className="text-sm sm:text-base text-foreground/90 leading-relaxed whitespace-pre-line">
            {stretch.lookFor}
          </p>
        </div>
      </div>
    </div>
  );
}

