import type { RailSegment } from "../rail";
import { formatTime } from "../utils";

export type DurationRailSize = "session" | "preview" | "mini";

interface DurationRailProps {
  segments: readonly RailSegment[];
  /** Omit to render a read-only rail. Present makes every segment a jump target. */
  onJumpTo?: (index: number) => void;
  /** Highlights a selected segment in read mode without changing progress. */
  selectedIndex?: number | null;
  /** Verb used by the accessible name for interactive segments. */
  actionLabel?: string;
  /** Tints the current segment as a rest period rather than a hold. */
  isResting?: boolean;
  size?: DurationRailSize;
  label?: string;
}

const sizeClass: Record<DurationRailSize, string> = {
  // Grows with the viewport so a wide screen buys a readable rail, not padding.
  session: "h-7 gap-[3px] sm:h-8 lg:h-[2.375rem]",
  preview: "h-7 gap-[3px] sm:h-8",
  mini: "h-1.5 gap-[2px]",
};

function segmentTone(segment: RailSegment, isResting: boolean): string {
  if (segment.state === "done") return "stretching-rail-seg--done";
  if (segment.state === "upcoming") return "stretching-rail-seg--upcoming";
  return isResting
    ? "stretching-rail-seg--resting"
    : "stretching-rail-seg--current";
}

function segmentLabel(segment: RailSegment): string {
  const sides = segment.repetitions > 1 ? `, ${segment.repetitions} sides` : "";
  const position =
    segment.state === "current"
      ? ", current step"
      : segment.state === "done"
        ? ", done"
        : "";
  return `${segment.index + 1}. ${segment.name}, ${formatTime(segment.weight)}${sides}${position}`;
}

/**
 * The routine drawn as a bar, each segment as wide as that stretch is long.
 * It is the progress display, the position marker and the jump control at
 * once, which is why it appears on library cards, in preview, during a session
 * and in the studio rather than three separate indicators.
 */
export function DurationRail({
  segments,
  onJumpTo,
  selectedIndex,
  actionLabel = "Jump to",
  isResting = false,
  size = "session",
  label,
}: DurationRailProps) {
  if (segments.length === 0) return null;

  const isMini = size === "mini";
  const summary =
    label ??
    `Routine rail, ${segments.length} ${segments.length === 1 ? "stretch" : "stretches"}`;
  const hasSelection = selectedIndex !== undefined && selectedIndex !== null;

  return (
    <div
      className={`stretching-rail stretching-rail--${size} flex w-full ${sizeClass[size]}`}
      role={onJumpTo ? "group" : "img"}
      aria-label={summary}
    >
      {segments.map((segment) => {
        const tone = segmentTone(segment, isResting);
        const isSelected = segment.index === selectedIndex;
        const selectionClass = isSelected
          ? "stretching-rail-seg--selected"
          : "";
        const style = { flexGrow: Math.max(segment.weight, 1) };

        if (isMini || !onJumpTo) {
          return (
            <span
              key={segment.index}
              aria-hidden={isMini ? "true" : undefined}
              aria-label={isMini ? undefined : segmentLabel(segment)}
              className={`stretching-rail-seg ${tone} ${selectionClass}`}
              style={style}
            >
              {!isMini && (
                <SegmentFace segment={segment} isResting={isResting} />
              )}
            </span>
          );
        }

        return (
          <button
            type="button"
            key={segment.index}
            onClick={() => onJumpTo(segment.index)}
            aria-current={segment.state === "current" ? "step" : undefined}
            aria-pressed={hasSelection ? isSelected : undefined}
            aria-label={`${actionLabel} ${segmentLabel(segment)}`}
            className={`stretching-rail-seg stretching-rail-seg--action ${tone} ${selectionClass}`}
            style={style}
            title={`${segment.name} (${formatTime(segment.weight)})`}
          >
            <SegmentFace segment={segment} isResting={isResting} />
          </button>
        );
      })}
    </div>
  );
}

function SegmentFace({
  segment,
  isResting,
}: {
  segment: RailSegment;
  isResting: boolean;
}) {
  return (
    <>
      {segment.state === "current" && !isResting && segment.fill > 0 && (
        <span
          aria-hidden="true"
          className="stretching-rail-fill"
          style={{ width: `${segment.fill * 100}%` }}
        />
      )}
      <span className="stretching-rail-text">
        {segment.index + 1}
        <span className="stretching-rail-detail">
          {segment.name} {formatTime(segment.weight)}
        </span>
      </span>
    </>
  );
}
