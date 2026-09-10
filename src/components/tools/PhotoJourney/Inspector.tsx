import { ChevronDown } from "lucide-react";
import { formatCoordinates } from "./journey-data";
import { groupMetadata } from "./metadata";
import type { JourneyPhoto } from "./types";

export default function Inspector({
  photo,
  index,
}: {
  photo?: JourneyPhoto;
  index: number;
}) {
  if (!photo) return null;
  const { metadata } = photo;
  const facts = [
    ["Captured", metadata.capturedAtLabel ?? "Date unavailable"],
    ["Place", metadata.place ?? "Place unavailable"],
    [
      "Coordinates",
      metadata.coordinates
        ? formatCoordinates(metadata.coordinates)
        : "No GPS in this photo",
    ],
    [
      "Altitude",
      metadata.altitude === undefined
        ? undefined
        : `${Math.round(metadata.altitude)} m`,
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
