import { useState } from "react";
import type { Stretch } from "@/components/tools/Stretching/types";
import { ImagePicker } from "./ImagePicker";
import { PLACEHOLDER_IMAGE } from "../images";
import { StretchImage } from "./StretchImage";

interface StretchFormProps {
  stretch: Stretch | null;
  onSubmit: (stretch: Omit<Stretch, "id">) => void;
  onCancel: () => void;
}

export function StretchForm({ stretch, onSubmit, onCancel }: StretchFormProps) {
  const [name, setName] = useState(stretch?.name || "");
  const [description, setDescription] = useState(stretch?.description || "");
  const [duration, setDuration] = useState(stretch?.duration || 60);
  const [repetitions, setRepetitions] = useState(stretch?.repetitions || 1);
  const [image, setImage] = useState(stretch?.image || "");
  const [how, setHow] = useState(stretch?.how || "");
  const [lookFor, setLookFor] = useState(stretch?.lookFor || "");
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      duration,
      repetitions,
      image: image || undefined,
      how,
      lookFor,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      <div>
        <label
          htmlFor="stretch-name"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Name *
        </label>
        <input
          id="stretch-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div>
        <label
          htmlFor="stretch-description"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Description *
        </label>
        <textarea
          id="stretch-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="stretch-duration"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            Duration (seconds) *
          </label>
          <input
            id="stretch-duration"
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            required
            min="1"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label
            htmlFor="stretch-repetitions"
            className="mb-2 block text-sm font-semibold text-foreground"
          >
            Repetitions *
          </label>
          <input
            id="stretch-repetitions"
            type="number"
            value={repetitions}
            onChange={(e) =>
              setRepetitions(Math.max(1, parseInt(e.target.value) || 1))
            }
            required
            min="1"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            e.g., 2 for left/right leg
          </p>
        </div>
      </div>
      <div>
        <label
          htmlFor="stretch-image-url"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          Image (optional)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Image Preview */}
          <div className="group relative">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-border/50 bg-muted sm:h-28 sm:w-28">
              {image ? (
                <StretchImage
                  src={imageLoadError ? PLACEHOLDER_IMAGE : image}
                  alt="Stretch preview"
                  className="h-full w-full object-cover"
                  onError={() => setImageLoadError(true)}
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                  <svg
                    className="mb-1 h-8 w-8"
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
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
            {image && (
              <button
                type="button"
                onClick={() => {
                  setImage("");
                  setImageLoadError(false);
                }}
                aria-label="Remove stretch image"
                className="absolute -right-2 -top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-md transition-opacity hover:bg-destructive/90 group-focus-within:opacity-100 group-hover:opacity-100"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Image Actions */}
          <div className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              onClick={() => setShowImagePicker(true)}
              aria-haspopup="dialog"
              aria-expanded={showImagePicker}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 active:bg-primary/30"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {image ? "Change Image" : "Browse Library"}
            </button>
            <div className="relative">
              <input
                id="stretch-image-url"
                type="url"
                value={image}
                onChange={(e) => {
                  setImage(e.target.value);
                  setImageLoadError(false);
                }}
                placeholder="Or paste image URL..."
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {imageLoadError && image && (
              <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Image failed to load - will use placeholder
              </p>
            )}
          </div>
        </div>
      </div>
      <div>
        <label
          htmlFor="stretch-how"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          What to Do *
        </label>
        <textarea
          id="stretch-how"
          value={how}
          onChange={(e) => setHow(e.target.value)}
          required
          rows={4}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Include instructions and tempo/cues..."
        />
      </div>
      <div>
        <label
          htmlFor="stretch-look-for"
          className="mb-2 block text-sm font-semibold text-foreground"
        >
          What to Feel *
        </label>
        <textarea
          id="stretch-look-for"
          value={lookFor}
          onChange={(e) => setLookFor(e.target.value)}
          required
          rows={3}
          className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="What sensations and feedback to look for..."
        />
      </div>
      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
        <button
          type="submit"
          className="min-h-[48px] flex-1 touch-manipulation rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {stretch ? "✓ Update Stretch" : "+ Add Stretch"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] flex-1 touch-manipulation rounded-xl bg-secondary/80 px-5 py-3 text-sm font-medium text-secondary-foreground shadow-sm transition-colors hover:bg-secondary active:bg-secondary/70 sm:flex-none"
        >
          Cancel
        </button>
      </div>

      {/* Image Picker Modal */}
      {showImagePicker && (
        <ImagePicker
          value={image}
          onChange={(url) => {
            setImage(url);
            setImageLoadError(false);
          }}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </form>
  );
}
