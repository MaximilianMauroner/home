import { memo, useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { photoDayKey } from "./days";
import { formatDayKeyRange } from "./journey-data";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";

/** Keep manual order. A return to an earlier day starts another labelled group. */
function groupPhotos(
  photos: JourneyPhoto[],
  placements: readonly Placement[] | undefined,
  timezone: string,
) {
  const groups: Array<{
    key: string;
    label: string;
    entries: Array<{ photo: JourneyPhoto; index: number }>;
  }> = [];
  photos.forEach((photo, index) => {
    const key = photoDayKey(photo, placements?.[index], timezone) ?? "undated";
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = { key, label: formatDayKeyRange(key) ?? "Undated", entries: [] };
      groups.push(group);
    }
    group.entries.push({ photo, index });
  });
  return groups;
}

const JourneyFilmstrip = memo(function JourneyFilmstrip({
  photos,
  placements,
  timezone,
  activeIndex,
  onSelect,
}: {
  photos: JourneyPhoto[];
  placements?: readonly Placement[];
  timezone: string;
  activeIndex: number;
  /** Selection pauses playback before moving to this photo. */
  onSelect: (index: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const groups = useMemo(
    () => groupPhotos(photos, placements, timezone),
    [photos, placements, timezone],
  );
  useEffect(() => {
    const container = strip.current;
    const active = container?.querySelector<HTMLElement>(
      "[aria-current='true']",
    );
    if (!container || !active) return;
    const bounds = container.getBoundingClientRect();
    const item = active.getBoundingClientRect();
    // Scroll only the filmstrip, so playback never moves the page or steals focus.
    if (item.left < bounds.left + 8)
      container.scrollLeft += item.left - bounds.left - 8;
    else if (item.right > bounds.right - 8)
      container.scrollLeft += item.right - bounds.right + 8;
  }, [activeIndex, groups]);
  const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const index = Number(event.target.dataset.index);
    const next =
      event.key === "ArrowRight"
        ? Math.min(photos.length - 1, index + 1)
        : event.key === "ArrowLeft"
          ? Math.max(0, index - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? photos.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect(next);
    strip.current
      ?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)
      ?.focus({ preventScroll: true });
  };
  if (!photos.length) return null;
  return (
    <div
      ref={strip}
      className="pj-filmstrip"
      role="region"
      aria-label="Journey photos by day"
      onKeyDown={navigate}
    >
      {groups.map((group, groupIndex) => (
        <div
          className="pj-filmstrip-day"
          role="group"
          aria-label={group.label}
          key={`${group.key}:${groupIndex}`}
        >
          <h3>{group.label}</h3>
          <div className="pj-filmstrip-photos">
            {group.entries.map(({ photo, index }) => (
              <button
                key={photo.id}
                data-index={index}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-label={`Show photo ${index + 1}: ${photo.name}`}
                title={photo.name}
                onClick={() => onSelect(index)}
              >
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <span aria-hidden="true">{index + 1}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
});

export default JourneyFilmstrip;
