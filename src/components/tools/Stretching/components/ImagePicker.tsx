import { useState, useMemo } from "react";
import { STRETCH_IMAGES, PLACEHOLDER_IMAGE } from "../images";

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

  const allImages = useMemo(() => getAllImages(), []);

  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return allImages;
    const query = searchQuery.toLowerCase();
    return allImages.filter(
      (img) =>
        img.name.toLowerCase().includes(query) ||
        img.routine.toLowerCase().includes(query)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-border/50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/50">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-foreground">
              Select Image
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose from library or add custom URL
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground"
          >
            <svg
              className="w-5 h-5"
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
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setActiveTab("library")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "library"
                ? "border-b-2 border-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4"
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
            onClick={() => setActiveTab("custom")}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === "custom"
                ? "border-b-2 border-primary text-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-4 h-4"
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
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === "library" && (
            <>
              {/* Search */}
              <div className="p-4 border-b border-border/50">
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
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
                    type="text"
                    placeholder="Search images by name or routine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <svg
                        className="w-4 h-4"
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
                      className="w-12 h-12 mb-3"
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
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredImages.map((img) => (
                      <button
                        key={img.url}
                        onClick={() => handleSelectImage(img.url)}
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg ${
                          value === img.url
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-border/50 hover:border-primary/50"
                        }`}
                      >
                        {/* Loading skeleton */}
                        {!loadedImages.has(img.url) &&
                          !failedImages.has(img.url) && (
                            <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
                              <svg
                                className="w-8 h-8 text-muted-foreground/50"
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
                        <img
                          src={failedImages.has(img.url) ? PLACEHOLDER_IMAGE : img.url}
                          alt={img.name}
                          className={`w-full h-full object-cover transition-opacity ${
                            loadedImages.has(img.url) || failedImages.has(img.url)
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                          onLoad={() => handleImageLoad(img.url)}
                          onError={() => handleImageError(img.url)}
                        />

                        {/* Overlay with name */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                          <span className="text-white text-xs font-medium line-clamp-2">
                            {img.name}
                          </span>
                          <span className="text-white/70 text-[10px]">
                            {img.routine}
                          </span>
                        </div>

                        {/* Selected checkmark */}
                        {value === img.url && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                            <svg
                              className="w-4 h-4 text-primary-foreground"
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
            </>
          )}

          {activeTab === "custom" && (
            <div className="p-4 sm:p-6 space-y-6">
              {/* Custom URL Input */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-foreground">
                  Image URL
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <p className="text-xs text-muted-foreground">
                  Enter a direct link to an image file (JPG, PNG, GIF, WebP)
                </p>
              </div>

              {/* Preview */}
              {customUrl && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-foreground">
                    Preview
                  </label>
                  <div className="relative aspect-video max-w-sm rounded-xl overflow-hidden bg-muted border border-border">
                    <img
                      src={customUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleCustomUrlSubmit}
                disabled={!customUrl.trim()}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Use This Image
              </button>

              {/* Helpful tips */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">
                  Tips for finding images
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
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
                      Make sure the URL ends with an image extension like .jpg,
                      .png, or .gif
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer with current selection */}
        {value && (
          <div className="p-4 border-t border-border/50 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={value}
                  alt="Selected"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                  }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Current selection
                </p>
                <p className="text-xs text-muted-foreground truncate">{value}</p>
              </div>
              <button
                onClick={() => {
                  onChange("");
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
