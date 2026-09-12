import { ChevronLeft, ChevronRight, ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Placement } from "./track";
import type { JourneyPhoto } from "./types";
import type { PhotoPreloadStatus } from "./usePhotoPreload";

export default function PhotoCheckpointDrawer({
  photos,
  activePhotoId,
  progress,
  imageProgress,
  photoProgress = 1,
  expanded,
  width,
  height,
  manuallyOpened,
  closed,
  originalStatus,
  placement,
  located,
  onBrowse,
  onClose,
  onInteract,
  onExpandedChange,
}: {
  photos: JourneyPhoto[];
  activePhotoId?: string;
  progress: number;
  imageProgress: number;
  photoProgress?: number;
  expanded: boolean;
  width: number;
  height: number;
  manuallyOpened: boolean;
  closed: boolean;
  originalStatus: PhotoPreloadStatus;
  placement?: Placement;
  located: boolean;
  onBrowse: (photoIndex: number) => void;
  onClose: () => void;
  onInteract: () => void;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const drawer = useRef<HTMLElement>(null);
  const [previewFailed, setPreviewFailed] = useState<string>();
  const [originalFailed, setOriginalFailed] = useState<string>();
  const index = Math.max(0, photos.findIndex((photo) => photo.id === activePhotoId));
  const photo = photos[index];
  const originalReady = originalStatus === "ready";
  const originalError = originalStatus === "error" || originalFailed === photo?.id;
  const place = !located || placement?.source === "carried" || placement?.source === "none"
    ? "Unlocated photo"
    : placement?.conflict && placement.source === "photo"
      ? "Photo GPS selected · recording differs"
      : placement?.conflict && placement.source === "track"
        ? "Recorded position selected · photo GPS differs"
        : placement?.source === "track"
          ? (photo?.metadata.place ?? "Recorded position")
          : (photo?.metadata.place ?? "Photo GPS");
  useEffect(() => {
    if (manuallyOpened && !closed) drawer.current?.focus();
  }, [manuallyOpened, closed]);
  useEffect(() => {
    if (!manuallyOpened || closed) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [manuallyOpened, closed, onClose]);
  const browse = useCallback((next: number) => {
    onInteract();
    onBrowse(Math.min(photos.length - 1, Math.max(0, next)));
  }, [onInteract, onBrowse, photos.length]);
  if (!photo || closed) return null;
  return (
    <aside
      ref={drawer}
      className="pj-checkpoint-drawer"
      data-expanded={expanded}
      data-manual={manuallyOpened}
      aria-label={`${photos.length === 1 ? "Photo" : `${photos.length} photos`} at checkpoint`}
      tabIndex={manuallyOpened ? -1 : undefined}
      style={{
        "--pj-drawer-progress": progress,
        "--pj-drawer-width": `${width}px`,
        "--pj-drawer-height": `${height}px`,
      } as CSSProperties}
    >
      <header className="pj-drawer-head">
        <div><span>Checkpoint</span><strong>{photos.length === 1 ? "1 photo" : `${photos.length} photos`}</strong></div>
        <div className="pj-drawer-actions">
          <button onClick={() => { onInteract(); onExpandedChange(!expanded); }} aria-label={expanded ? "Collapse photo drawer" : "Expand photo drawer"}>
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </button>
          {manuallyOpened && <button onClick={onClose} aria-label="Close photo drawer"><X /></button>}
        </div>
      </header>
      <div className="pj-drawer-viewer" style={{ "--pj-image-progress": imageProgress } as CSSProperties}>
        {photoProgress < 1 && index > 0 && <img className="pj-drawer-previous" src={photos[index - 1].thumbnailUrl} alt="" aria-hidden="true" />}
        <div className="pj-drawer-image" style={{ opacity: photoProgress }}>
        {previewFailed !== photo.id ? <img key={`${photo.id}:preview`} className="pj-drawer-preview" src={photo.thumbnailUrl} alt={photo.name} onError={() => setPreviewFailed(photo.id)} />
          : <div className="pj-photo-fallback" role="img" aria-label={`${photo.name}; preview unavailable`}><span>Preview unavailable</span></div>}
        {originalReady && !originalError && <img key={`${photo.id}:original`} className="pj-drawer-original" src={photo.url} alt="" onError={() => setOriginalFailed(photo.id)} />}
        </div>
        {originalError && <p className="pj-photo-status" role="status">Original unavailable; showing preview.</p>}
        <a className="pj-full-resolution" href={photo.url} target="_blank" rel="noreferrer" onClick={onInteract}>
          <ExternalLink aria-hidden="true" /> Full resolution
        </a>
      </div>
      <section className="pj-drawer-copy">
        <p data-located={located}>{place}</p>
        <h2>{photo.name}</h2>
      </section>
      <CheckpointStrip photos={photos} index={index} browse={browse} />
    </aside>
  );
}

// A long burst must not reconcile hundreds of thumbnails on each animation frame.
const CheckpointStrip = memo(function CheckpointStrip({ photos, index, browse }: {
  photos: JourneyPhoto[];
  index: number;
  browse: (index: number) => void;
}) {
  return <div className="pj-drawer-strip" role="group" aria-label="Photos at this checkpoint">
        <button disabled={index === 0} onClick={() => browse(index - 1)} aria-label="Previous checkpoint photo"><ChevronLeft /></button>
        {photos.map((entry, photoIndex) => <button key={entry.id} data-active={photoIndex === index} onClick={() => browse(photoIndex)} aria-label={`Show ${entry.name}`} aria-current={photoIndex === index ? "true" : undefined}><img src={entry.thumbnailUrl} alt="" /></button>)}
        <button disabled={index === photos.length - 1} onClick={() => browse(index + 1)} aria-label="Next checkpoint photo"><ChevronRight /></button>
      </div>;
});
