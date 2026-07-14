import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalDialog } from "@/utils/useModalDialog";
import { STRETCH_IMAGES, PLACEHOLDER_IMAGE } from "../images";
import { StretchImage } from "./StretchImage";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  onClose: () => void;
}

// Extract all unique images from STRETCH_IMAGES with their names
function getAllImages(): Array<{ url: string; name: string; routine: string }> {
  const images: Array<{ url: string; name: string; routine: string }> = [];
  const seenUrls = new Set<string>();

  for (const [routineKey, stretches] of Object.entries(STRETCH_IMAGES)) {
    for (const [stretchKey, url] of Object.entries(stretches)) {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        // Convert kebab-case to readable name
        const name = stretchKey
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        const routine = routineKey
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        images.push({ url, name, routine });
      }
    }
  }

  return images;
}

export function ImagePicker({ value, onChange, onClose }: ImagePickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"library" | "custom">("library");
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  useModalDialog({
    dialogRef,
    initialFocusSelector: "[data-dialog-initial-focus]",
    isOpen: true,
    onClose,
  });

  const allImages = useMemo(() => getAllImages(), []);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return allImages;
    const query = searchQuery.toLowerCase();
    return allImages.filter(
      (img) =>
        img.name.toLowerCase().includes(query) ||
        img.routine.toLowerCase().includes(query),
    );
  }, [allImages, searchQuery]);

  const handleSelectImage = (url: string) => {
    onChange(url);
    onClose();
  };

  const handleCustomUrlSubmit = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim());
      onClose();
    }
  };

  const handleImageLoad = (url: string) => {
    setLoadedImages((prev) => new Set(prev).add(url));
  };

  const handleImageError = (url: string) => {
    setFailedImages((prev) => new Set(prev).add(url));
  };

  return createPortal(
    <div data-modal-root="stretch-image-picker">
      <div
        aria-hidden="true"
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stretch-image-picker-title"
          aria-describedby="stretch-image-picker-description"
          tabIndex={-1}
          className="pointer-events-auto flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border/50 bg-card shadow-sm focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 p-4 sm:p-5">
            <div>
              <h2
                id="stretch-image-picker-title"
                className="text-lg font-bold text-foreground sm:text-xl"
              >
                Select Image
              </h2>
              <p
                id="stretch-image-picker-description"
                className="mt-0.5 text-sm text-muted-foreground"
              >
                Choose from library or add custom URL
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image picker"
              data-dialog-initial-focus
              className="min-h-11 min-w-11 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex border-b border-border/50"
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
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "library"
                  ? "border-b-2 border-primary bg-primary/5 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Image Library ({allImages.length})
              </span>
            </button>
            <button
              type="button"
              role="tab"
              id="custom-image-tab"
              aria-selected={activeTab === "custom"}
              aria-controls="custom-image-panel"
              onClick={() => setActiveTab("custom")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === "custom"
                  ? "border-b-2 border-primary bg-primary/5 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Custom URL
              </span>
            </button>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {activeTab === "library" && (
              <div
                id="image-library-panel"
                role="tabpanel"
                aria-labelledby="image-library-tab"
                className="flex min-h-0 flex-1 flex-col"
              >
                {/* Search */}
                <div className="border-b border-border/50 p-4">
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      id="stretch-image-search"
                      type="text"
                      aria-label="Search image library"
                      placeholder="Search images by name or routine..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="Clear image search"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Image Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {filteredImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <svg
                        className="mb-3 h-12 w-12"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <p className="text-sm">No images found</p>
                      <p className="mt-1 text-xs">
                        Try a different search term
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {filteredImages.map((img) => (
                        <button
                          type="button"
                          key={img.url}
                          aria-label={`Select image: ${img.name}`}
                          aria-pressed={value === img.url}
                          onClick={() => handleSelectImage(img.url)}
                          className={`group relative aspect-square overflow-hidden rounded-xl border-2 transition-colors hover:shadow-sm ${
                            value === img.url
                              ? "border-primary ring-2 ring-primary/30"
                              : "border-border/50 hover:border-primary/50"
                          }`}
                        >
                          {/* Loading skeleton */}
                          {!loadedImages.has(img.url) &&
                            !failedImages.has(img.url) && (
                              <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-muted">
                                <svg
                                  className="h-8 w-8 text-muted-foreground/50"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                              </div>
                            )}

                          {/* Image */}
                          <StretchImage
                            src={
                              failedImages.has(img.url)
                                ? PLACEHOLDER_IMAGE
                                : img.url
                            }
                            alt={img.name}
                            className={`h-full w-full object-cover transition-opacity ${
                              loadedImages.has(img.url) ||
                              failedImages.has(img.url)
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                            onLoad={() => handleImageLoad(img.url)}
                            onError={() => handleImageError(img.url)}
                            sizes="(min-width: 768px) 160px, (min-width: 640px) 30vw, 50vw"
                          />

                          {/* Overlay with name */}
                          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                            <span className="line-clamp-2 text-xs font-medium text-white">
                              {img.name}
                            </span>
                            <span className="text-[10px] text-white/70">
                              {img.routine}
                            </span>
                          </div>

                          {/* Selected checkmark */}
                          {value === img.url && (
                            <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow-md">
                              <svg
                                className="h-4 w-4 text-primary-foreground"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
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
                className="space-y-6 p-4 sm:p-6"
              >
                {/* Custom URL Input */}
                <div className="space-y-3">
                  <label
                    htmlFor="custom-image-url"
                    className="block text-sm font-semibold text-foreground"
                  >
                    Image URL
                  </label>
                  <input
                    id="custom-image-url"
                    type="url"
                    aria-describedby="custom-image-url-help"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <p
                    id="custom-image-url-help"
                    className="text-xs text-muted-foreground"
                  >
                    Enter a direct link to an image file (JPG, PNG, GIF, WebP)
                  </p>
                </div>

                {/* Preview */}
                {customUrl && (
                  <div className="space-y-3">
                    <p className="block text-sm font-semibold text-foreground">
                      Preview
                    </p>
                    <div className="relative aspect-video max-w-sm overflow-hidden rounded-xl border border-border bg-muted">
                      <StretchImage
                        src={customUrl}
                        alt="Preview"
                        className="h-full w-full object-cover"
                        sizes="384px"
                      />
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="button"
                  onClick={handleCustomUrlSubmit}
                  disabled={!customUrl.trim()}
                  className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use This Image
                </button>

                {/* Helpful tips */}
                <div className="space-y-2 rounded-xl bg-muted/50 p-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    Tips for finding images
                  </h4>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>
                        Use{" "}
                        <a
                          href="https://commons.wikimedia.org"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Wikimedia Commons
                        </a>{" "}
                        for free, properly licensed images
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>
                        Right-click an image and select "Copy image address" to
                        get the URL
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>
                        Make sure the URL ends with an image extension like
                        .jpg, .png, or .gif
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Footer with current selection */}
          {value && (
            <div className="border-t border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  <StretchImage
                    src={value}
                    alt="Selected"
                    className="h-full w-full object-cover"
                    sizes="48px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Current selection
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {value}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    onClose();
                  }}
                  className="rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
                >
                  Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
