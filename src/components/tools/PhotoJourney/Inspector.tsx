import { ChevronDown } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { formatCoordinates } from "./journey-data";
import { groupMetadata, parseOffsetMinutes } from "./metadata";
import type { Placement, PlacementChoice } from "./track";
import type { JourneyPhoto, JourneyRecording } from "./types";

/** How the stop reached its position, in the words of the decision that put it there. */
function placedBy(placement: Placement) {
  const off = placement.discrepancyM === undefined ? undefined : `${Math.round(placement.discrepancyM).toLocaleString("en")} m from the track`;
  if (placement.conflict) {
    if (placement.source === "track") return off ? `Recording, by timecode. The camera's fix was ${off}.` : "Recording, by timecode (chosen).";
    if (placement.source === "photo") return off ? `This photo's own GPS (chosen), ${off}.` : "This photo's own GPS (chosen).";
    return "No position chosen yet.";
  }
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
  recordings,
  choice,
  offsetMinutes,
  onSetOffset,
  onChoosePlacement,
}: {
  photo?: JourneyPhoto;
  placement?: Placement;
  index: number;
  recordings?: readonly JourneyRecording[];
  choice?: PlacementChoice;
  offsetMinutes?: number;
  onSetOffset?: (photoId: string, minutes: number | undefined) => void;
  onChoosePlacement?: (photoId: string, choice: PlacementChoice | undefined) => void;
}) {
  const [offsetInput, setOffsetInput] = useState(offsetMinutes === undefined ? "" : String(offsetMinutes));
  useEffect(() => setOffsetInput(offsetMinutes === undefined ? "" : String(offsetMinutes)), [photo?.id, offsetMinutes]);
  if (!photo) return null;
  const { metadata } = photo;
  // A carried position belongs to the stop before this one, so it is not this photo's coordinates.
  const located = placement?.source === "photo" || placement?.source === "track";
  const shown = located ? placement.coordinates : metadata.coordinates;
  const effectivePlace = placement?.conflict && placement.source === "photo"
    ? "Photo GPS selected · recording differs"
    : placement?.conflict && placement.source === "track"
      ? "Recorded position selected"
      : placement?.conflict
        ? "Location needs a choice"
    : placement?.source === "track" && (placement.discrepancyM === undefined || placement.discrepancyM > 60)
      ? "Recorded position"
      : metadata.place;
  const unresolvedClock = Boolean(metadata.capturedAtWallClock && metadata.utcOffsetMinutes === undefined);
  const capturedLabel = metadata.capturedAtLabel
    ? `${metadata.capturedAtLabel}${unresolvedClock ? (placement?.instant === undefined ? " · time not resolved" : " · time resolved") : ""}`
    : "Date unavailable";
  const facts = [
    ["Captured", capturedLabel],
    ["Place", effectivePlace ?? "Place unavailable"],
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
  const sourceName = placement?.recordingId
    ? recordings?.find((recording) => recording.id === placement.recordingId)?.name
    : undefined;
  const canChoose = Boolean(placement?.trackCoordinates && onChoosePlacement && !placement.ambiguous);
  const currentChoice = placement?.source === "track" ? "track" : placement?.source === "photo" ? "photo" : undefined;
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
      {placement?.ambiguous && (
        <div className="pj-placement-choice" role="status">
          <strong>Recordings overlap at this time</strong>
          <p>There is no single recording position to accept. Exclude one of the overlapping recordings above, then choose the remaining position here.</p>
        </div>
      )}
      {placement?.choiceUnavailable && (
        <div className="pj-placement-choice" role="status">
          <strong>Selected recording is unavailable</strong>
          <p>The chosen recording no longer covers this photo's resolved time. Reset the choice to use another available source.</p>
          {onChoosePlacement && <button className="pj-pill" data-size="sm" onClick={() => onChoosePlacement(photo.id, undefined)}>Reset recording choice</button>}
        </div>
      )}
      {canChoose && placement && (
        <div className="pj-placement-choice" role="group" aria-label="Photo location source">
          <strong>{placement.conflict ? "Photo and recording positions differ" : "Choose the position to use"}</strong>
          <p>
            {placement.discrepancyM !== undefined
              ? `${Math.round(placement.discrepancyM).toLocaleString("en")} m apart${sourceName ? ` · ${sourceName}` : ""}. The camera position stays selected until you change it.`
              : `A recording has a position for this photo${sourceName ? ` · ${sourceName}` : ""}.`}
          </p>
          <div className="pj-placement-buttons">
            {metadata.coordinates && <button className="pj-pill" data-size="sm" aria-pressed={currentChoice === "photo"} onClick={() => onChoosePlacement?.(photo.id, "photo")}>Use photo GPS</button>}
            <button className="pj-pill" data-size="sm" aria-pressed={currentChoice === "track"} onClick={() => onChoosePlacement?.(photo.id, placement.recordingId ? { source: "track", recordingId: placement.recordingId } : "track")}>Use recording</button>
            {choice && <button className="pj-pill" data-size="sm" onClick={() => onChoosePlacement?.(photo.id, undefined)}>Reset</button>}
          </div>
        </div>
      )}
      {unresolvedClock && onSetOffset && (
        <div className="pj-time-choice">
          <strong>Resolve this camera clock</strong>
          <p>This wall clock has no timezone. Enter minutes east of UTC only when you know the camera's setting.</p>
          <div className="pj-placement-buttons">
            <input aria-label="Camera UTC offset in minutes" type="number" min={-720} max={840} step={15} value={offsetInput} placeholder="e.g. 120" onChange={(event) => setOffsetInput(event.target.value)} aria-invalid={Boolean(offsetInput && parseOffsetMinutes(offsetInput) === undefined)} />
            <button className="pj-pill" data-size="sm" data-tone="accent" disabled={parseOffsetMinutes(offsetInput) === undefined} onClick={() => {
              const value = parseOffsetMinutes(offsetInput);
              if (value !== undefined) onSetOffset(photo.id, value);
            }}>Set offset</button>
            {offsetMinutes !== undefined && <button className="pj-pill" data-size="sm" onClick={() => onSetOffset(photo.id, undefined)}>Clear</button>}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(Inspector);
