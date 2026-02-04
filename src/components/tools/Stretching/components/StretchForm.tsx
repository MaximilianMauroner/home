import { useState } from "react";
import type { Stretch } from "@/components/tools/Stretching/types";
import { ImagePicker } from "./ImagePicker";
import { PLACEHOLDER_IMAGE } from "../images";

interface StretchFormProps {
  stretch: Stretch | null;
  onSubmit: (stretch: Omit<Stretch, "id">) => void;
  onCancel: () => void;
}

export function StretchForm({ stretch, onSubmit, onCancel }: StretchFormProps) {
  const [name, setName] = useState(stretch?.name || "");
  const [description, setDescription] = useState(stretch?.description || "");
  const [duration, setDuration] = useState(stretch?.duration || 60);
  const [repetitions, setRepetitions] = useState((stretch as any)?.repetitions || 1);
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
        <label className="block text-sm font-semibold mb-2 text-foreground">Name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={2}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Duration (seconds) *</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Repetitions *</label>
          <input
            type="number"
            value={repetitions}
            onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value) || 1))}
            required
            min="1"
            className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
          <p className="text-xs text-muted-foreground mt-1">e.g., 2 for left/right leg</p>
        </div>
      </div>
      <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Image (optional)</label>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Image Preview */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-muted border-2 border-border/50 flex-shrink-0">
                {image ? (
                  <img
                    src={imageLoadError ? PLACEHOLDER_IMAGE : image}
                    alt="Stretch preview"
                    className="w-full h-full object-cover"
                    onError={() => setImageLoadError(true)}
                    onLoad={() => setImageLoadError(false)}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                    <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive/90"
                  title="Remove image"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Image Actions */}
            <div className="flex-1 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowImagePicker(true)}
                className="w-full px-4 py-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 active:bg-primary/30 transition-all font-medium text-sm flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {image ? "Change Image" : "Browse Library"}
              </button>
              <div className="relative">
                <input
                  type="url"
                  value={image}
                  onChange={(e) => {
                    setImage(e.target.value);
                    setImageLoadError(false);
                  }}
                  placeholder="Or paste image URL..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                />
              </div>
              {imageLoadError && image && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Image failed to load - will use placeholder
                </p>
              )}
            </div>
          </div>
        </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Do *</label>
        <textarea
          value={how}
          onChange={(e) => setHow(e.target.value)}
          required
          rows={4}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="Include instructions and tempo/cues..."
        />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">What to Feel *</label>
        <textarea
          value={lookFor}
          onChange={(e) => setLookFor(e.target.value)}
          required
          rows={3}
          className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
          placeholder="What sensations and feedback to look for..."
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 px-5 py-3 min-h-[48px] bg-gradient-to-r from-primary to-primary/90 text-primary-foreground rounded-xl hover:from-primary/90 hover:to-primary/80 active:scale-[0.98] transition-all font-semibold text-sm touch-manipulation shadow-lg"
        >
          {stretch ? "✓ Update Stretch" : "+ Add Stretch"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 sm:flex-none px-5 py-3 min-h-[48px] bg-secondary/80 text-secondary-foreground rounded-xl hover:bg-secondary active:bg-secondary/70 transition-all font-medium text-sm touch-manipulation shadow-sm"
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

