import { memo } from "react";
import type {
  SimilarPhotoGroup,
  SimilarPhotoOverride,
} from "./photo-similarity";
import type { JourneyPhoto } from "./types";

function SimilarPhotosPanel({
  photos,
  groups,
  overrides,
  status,
  showAll,
  onShowAll,
  onChoose,
  onKeepAll,
}: {
  photos: readonly JourneyPhoto[];
  groups: readonly SimilarPhotoGroup[];
  overrides: Readonly<Record<string, SimilarPhotoOverride | undefined>>;
  status: "idle" | "analyzing" | "ready" | "unavailable";
  showAll: boolean;
  onShowAll: (show: boolean) => void;
  onChoose: (groupId: string, photoId: string) => void;
  onKeepAll: (groupId: string, keep: boolean) => void;
}) {
  const byId = new Map(photos.map((photo) => [photo.id, photo]));
  const hidden = showAll
    ? 0
    : groups.reduce(
        (total, group) =>
          total +
          (group.recommendedId && !overrides[group.id]?.keepAll
            ? group.photoIds.length - 1
            : 0),
        0,
      );
  return (
    <section className="pj-similar" aria-label="Similar photos">
      <div className="pj-similar-summary">
        <div>
          <strong>
            {status === "analyzing"
              ? "Choosing the best photos…"
              : status === "unavailable"
                ? "Best-photo analysis is unavailable"
                : groups.length
                  ? `${groups.length} similar group${groups.length === 1 ? "" : "s"} · ${hidden ? `${hidden} photo${hidden === 1 ? "" : "s"} left out` : "all photos shown"}`
                  : "No similar photos found"}
          </strong>
          <p>
            Picks favor expressions and open eyes, composition, and the moment.
            Every original stays in the saved project.
          </p>
          {status === "unavailable" && (
            <p role="status">
              The local face model could not load, so Journey kept every photo.
            </p>
          )}
        </div>
        <label className="pj-pill pj-toggle">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(event) => onShowAll(event.target.checked)}
          />
          Show all photos
        </label>
      </div>
      {groups.map((group, groupIndex) => {
        const override = overrides[group.id];
        const selectedId = override?.representativeId ?? group.recommendedId;
        return (
          <article className="pj-similar-group" key={group.id}>
            <header>
              <div>
                <h3>Similar group {groupIndex + 1}</h3>
                <p>{group.photoIds.length} versions of this moment</p>
              </div>
              <button
                className="pj-pill"
                aria-pressed={Boolean(override?.keepAll)}
                onClick={() => onKeepAll(group.id, !override?.keepAll)}
              >
                {override?.keepAll ? "Use best pick" : "Keep all"}
              </button>
            </header>
            <div className="pj-similar-options">
              {group.photoIds.map((photoId) => {
                const photo = byId.get(photoId);
                if (!photo) return null;
                const score = group.scores?.find(
                  (entry) => entry.photoId === photoId,
                );
                const selected = photoId === selectedId && !override?.keepAll;
                return (
                  <button
                    key={photoId}
                    className="pj-similar-option"
                    aria-pressed={selected}
                    onClick={() => onChoose(group.id, photoId)}
                  >
                    <img src={photo.thumbnailUrl} alt="" loading="lazy" />
                    <span>
                      <strong>{photo.name}</strong>
                      <small>
                        {selected
                          ? (score?.reason ?? "Selected photo")
                          : "Use this photo"}
                      </small>
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default memo(SimilarPhotosPanel);
