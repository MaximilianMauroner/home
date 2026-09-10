import { ChevronDown } from "lucide-react";
import { memo } from "react";
import { formatCoordinates } from "./journey-data";
import { groupMetadata } from "./metadata";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";

/** How the stop reached its position, in the words of the decision that put it there. */
function placedBy(placement: Placement) {
  const off = placement.discrepancyM === undefined ? undefined : `${Math.round(placement.discrepancyM).toLocaleString("en")} m from the track`;
  if (placement.source === "track")
    return off ? `Track, by timecode. The camera's fix was ${off}.` : "Track, by timecode. This photo has no GPS.";
  if (placement.source === "photo")
    return off ? `This photo's own GPS, ${off}.` : "This photo's own GPS.";
  if (placement.source === "carried") return "Held at the previous stop. Nothing places this photo.";
  return "Not placed.";
}

/** Memoized for the same reason as the stop list: the clock renders the tool every frame. */
function Inspector({
  photo,
  placement,
  index,
}: {
  photo?: JourneyPhoto;
  placement?: Placement;
  index: number;
}) {
  if (!photo) return null;
  const { metadata } = photo;
  // A carried position belongs to the stop before this one, so it is not this photo's coordinates.
  const located = placement?.source === "photo" || placement?.source === "track";
  const shown = located ? placement.coordinates : metadata.coordinates;
  const facts = [
    ["Captured", metadata.capturedAtLabel ?? "Date unavailable"],
    ["Place", metadata.place ?? "Place unavailable"],
    [
      "Coordinates",
      shown ? formatCoordinates(shown) : "No GPS in this photo",
    ],
    [
      "Placed by",
      placement && (placement.source !== "photo" || placement.discrepancyM !== undefined)
        ? placedBy(placement)
        : undefined,
    ],
    [
      "Altitude",
      (placement?.elevation ?? metadata.altitude) === undefined
        ? undefined
        : `${Math.round((placement?.elevation ?? metadata.altitude)!)} m`,
    ],
    ["Camera", metadata.camera],
    ["Lens", metadata.lens],
    [
      "Exposure",
      [
        metadata.focalLength,
        metadata.aperture,
        metadata.shutterSpeed,
        metadata.iso,
      ]
        .filter(Boolean)
        .join(" · "),
    ],
    ["Image", `${metadata.dimensions} · ${metadata.fileSize}`],
    ["File", `${metadata.fileType} · modified ${metadata.modifiedAtLabel}`],
  ];
  return (
    <section className="pj-panel pj-inspector" aria-live="polite" aria-label="Photo details">
      <header className="pj-panel-head">
        <span className="pj-label">Stop {String(index + 1).padStart(2, "0")}</span>
        <h2>{photo.name}</h2>
      </header>
      <dl className="pj-facts">
        {facts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {metadata.details.length > 0 && (
        <details className="pj-more">
          <summary>
            All readable metadata
            <span>{metadata.details.length} tags <ChevronDown size={14} /></span>
          </summary>
          <div className="pj-metadata-groups">
            {groupMetadata(metadata.details).map((group) => (
              <section key={group.name}>
                <h3>{group.name}</h3>
                <dl>
                  {group.details.map((item) => (
                    <div key={item.rawLabel}>
                      <dt title={item.rawLabel}>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

export default memo(Inspector);
