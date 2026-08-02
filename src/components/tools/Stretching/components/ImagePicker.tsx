import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/utils/useModalDialog";
import { STRETCH_IMAGES, PLACEHOLDER_IMAGE } from "../images";
import {
  buildImageCatalog,
  filterImageCatalog,
  getDraftSelection,
} from "../imageCatalog";
import { StretchImage } from "./StretchImage";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  onClose: () => void;
}

export function ImagePicker({ value, onChange, onClose }: ImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [routineFilter, setRoutineFilter] = useState("");
  const [customUrl, setCustomUrl] = useState(
    value.startsWith("http") ? value : "",
  );
  const [activeTab, setActiveTab] = useState<"library" | "custom">("library");
  const [draftSelection, setDraftSelection] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalDialog({
    dialogRef,
    initialFocusSelector: "[data-dialog-initial-focus]",
    isOpen: true,
    onClose,
  });

  const catalog = useMemo(() => buildImageCatalog(STRETCH_IMAGES), []);
  const routines = useMemo(
    () => [...new Set(catalog.flatMap((image) => image.routines))].sort(),
    [catalog],
  );
  const filteredImages = useMemo(
    () => filterImageCatalog(catalog, searchQuery, routineFilter),
    [catalog, searchQuery, routineFilter],
  );
  const selected = getDraftSelection(value, draftSelection);

  const confirmSelection = () => {
    onChange(selected);
    onClose();
  };

  return createPortal(
    <div data-modal-root="stretch-image-picker">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stretch-image-picker-title"
          aria-describedby="stretch-image-picker-description"
          tabIndex={-1}
          className="pointer-events-auto flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-card pb-[env(safe-area-inset-bottom)] shadow-xl focus:outline-none sm:h-auto sm:max-h-[85vh] sm:max-w-4xl sm:rounded-2xl sm:border sm:border-border/60 sm:pb-0"
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 p-4 sm:p-5">
            <div className="min-w-0">
              <h2
                id="stretch-image-picker-title"
                className="text-lg font-semibold sm:text-xl"
              >
                Choose an image
              </h2>
              <p
                id="stretch-image-picker-description"
                className="truncate text-sm text-muted-foreground"
              >
                Review your choice, then confirm.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image picker"
              className="min-h-11 min-w-11 shrink-0 rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ✕
            </button>
          </header>

          <div
            className="flex shrink-0 border-b border-border/60"
            role="tablist"
            aria-label="Image source"
          >
            <button
              type="button"
              role="tab"
              id="image-library-tab"
              aria-selected={activeTab === "library"}
              aria-controls="image-library-panel"
              onClick={() => setActiveTab("library")}
              className={`min-h-11 flex-1 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${activeTab === "library" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              Library ({catalog.length})
            </button>
            <button
              type="button"
              role="tab"
              id="custom-image-tab"
              aria-selected={activeTab === "custom"}
              aria-controls="custom-image-panel"
              onClick={() => setActiveTab("custom")}
              className={`min-h-11 flex-1 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${activeTab === "custom" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
            >
              Custom URL
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "library" && (
              <div
                id="image-library-panel"
                role="tabpanel"
                aria-labelledby="image-library-tab"
                className="min-h-full"
              >
                <div className="sticky top-0 z-10 grid gap-2 border-b border-border/60 bg-card/95 p-3 backdrop-blur sm:grid-cols-[minmax(0,1fr)_13rem] sm:p-4">
                  <label className="relative min-w-0">
                    <span className="sr-only">Search image library</span>
                    <input
                      data-dialog-initial-focus
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search images"
                      className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="sr-only">Filter by routine</span>
                    <select
                      value={routineFilter}
                      onChange={(event) => setRoutineFilter(event.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="">All routines</option>
                      {routines.map((routine) => (
                        <option key={routine} value={routine}>
                          {routine}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="p-3 sm:p-4">
                  {filteredImages.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                      No images match those filters.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {filteredImages.map((image) => (
                        <button
                          type="button"
                          key={image.url}
                          aria-label={`Select ${image.name}`}
                          aria-pressed={selected === image.url}
                          onClick={() => setDraftSelection(image.url)}
                          className={`group relative aspect-square min-h-11 overflow-hidden rounded-xl border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selected === image.url ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/60"}`}
                        >
                          {!loadedImages.has(image.url) &&
                            !failedImages.has(image.url) && (
                              <div className="absolute inset-0 animate-pulse bg-muted" />
                            )}
                          <StretchImage
                            src={
                              failedImages.has(image.url)
                                ? PLACEHOLDER_IMAGE
                                : image.url
                            }
                            alt=""
                            className={`h-full w-full object-contain object-center ${loadedImages.has(image.url) || failedImages.has(image.url) ? "opacity-100" : "opacity-0"}`}
                            onLoad={() =>
                              setLoadedImages((current) =>
                                new Set(current).add(image.url),
                              )
                            }
                            onError={() =>
                              setFailedImages((current) =>
                                new Set(current).add(image.url),
                              )
                            }
                            sizes="(min-width: 768px) 160px, 50vw"
                          />
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 text-left text-xs font-medium text-white">
                            {image.name}
                          </span>
                          {selected === image.url && (
                            <span
                              aria-hidden="true"
                              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              ✓
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "custom" && (
              <div
                id="custom-image-panel"
                role="tabpanel"
                aria-labelledby="custom-image-tab"
                className="space-y-5 p-4 sm:p-6"
              >
                <div>
                  <label
                    htmlFor="custom-image-url"
                    className="mb-2 block text-sm font-medium"
                  >
                    Image URL
                  </label>
                  <input
                    id="custom-image-url"
                    data-dialog-initial-focus
                    type="url"
                    value={customUrl}
                    onChange={(event) => {
                      setCustomUrl(event.target.value);
                      setDraftSelection(event.target.value.trim());
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    The image stays browser-local as part of your routine data.
                  </p>
                </div>
                {customUrl.trim() && (
                  <div className="aspect-video max-w-lg overflow-hidden rounded-xl border border-border bg-muted">
                    <StretchImage
                      src={customUrl.trim()}
                      alt="Custom image preview"
                      className="h-full w-full object-contain object-center"
                      sizes="512px"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-border/60 bg-card p-3 sm:p-4">
            {selected && (
              <div className="mb-3 flex min-w-0 items-center gap-3">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <StretchImage
                    src={selected}
                    alt="Draft selection"
                    className="h-full w-full object-contain object-center"
                    sizes="44px"
                  />
                </div>
                <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {selected}
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDraftSelection("")}
                className="min-h-11 rounded-xl px-4 text-sm font-medium text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Remove
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 flex-1 rounded-xl bg-secondary px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSelection}
                className="min-h-11 flex-1 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
              >
                Confirm image
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>,
    document.body,
  );
}
