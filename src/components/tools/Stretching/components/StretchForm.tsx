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

interface StretchFields {
  description: string;
  duration: number;
  how: string;
  image: string;
  lookFor: string;
  name: string;
  repetitions: number;
}

function initialFields(stretch: Stretch | null): StretchFields {
  return {
    name: stretch?.name ?? "",
    description: stretch?.description ?? "",
    duration: stretch?.duration ?? 60,
    repetitions: stretch?.repetitions ?? 1,
    image: stretch?.image ?? "",
    how: stretch?.how ?? "",
    lookFor: stretch?.lookFor ?? "",
  };
}

export function StretchForm({ stretch, onSubmit, onCancel }: StretchFormProps) {
  const initial = initialFields(stretch);
  const [fields, setFields] = useState<StretchFields>(initial);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const isDirty = JSON.stringify(fields) !== JSON.stringify(initial);
  const setField = <K extends keyof StretchFields>(
    key: K,
    value: StretchFields[K],
  ) => setFields((current) => ({ ...current, [key]: value }));

  const requestCancel = () => {
    if (isDirty && !window.confirm("Discard your unsaved stretch changes?"))
      return;
    onCancel();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({
      ...fields,
      name: fields.name.trim(),
      description: fields.description.trim(),
      how: fields.how.trim(),
      lookFor: fields.lookFor.trim(),
      image: fields.image.trim() || undefined,
      ...(stretch?.targetAreas
        ? { targetAreas: [...stretch.targetAreas] }
        : {}),
    });
  };

  const inputClass =
    "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <form onSubmit={handleSubmit} className="min-w-0 pb-24 sm:pb-0">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Routine Studio
          </p>
          <h3 className="text-xl font-semibold">
            {stretch ? "Edit stretch" : "Add stretch"}
          </h3>
        </div>
        <button
          type="button"
          onClick={requestCancel}
          aria-label="Close stretch form"
          className="min-h-11 min-w-11 rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ✕
        </button>
      </header>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-5">
          <fieldset className="space-y-4 rounded-2xl border border-border/60 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold">Basics</legend>
            <div>
              <label
                htmlFor="stretch-name"
                className="mb-2 block text-sm font-medium"
              >
                Name
              </label>
              <input
                id="stretch-name"
                required
                autoFocus
                value={fields.name}
                onChange={(event) => setField("name", event.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="stretch-description"
                className="mb-2 block text-sm font-medium"
              >
                Description
              </label>
              <textarea
                id="stretch-description"
                required
                rows={3}
                value={fields.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
                className={`${inputClass} resize-y`}
              />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-2xl border border-border/60 p-4 sm:grid-cols-2 sm:p-5">
            <legend className="px-2 text-sm font-semibold">Timing</legend>
            <div>
              <label
                htmlFor="stretch-duration"
                className="mb-2 block text-sm font-medium"
              >
                Seconds
              </label>
              <input
                id="stretch-duration"
                type="number"
                min="1"
                required
                value={fields.duration}
                onChange={(event) =>
                  setField(
                    "duration",
                    Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  )
                }
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="stretch-repetitions"
                className="mb-2 block text-sm font-medium"
              >
                Repetitions
              </label>
              <input
                id="stretch-repetitions"
                type="number"
                min="1"
                required
                value={fields.repetitions}
                onChange={(event) =>
                  setField(
                    "repetitions",
                    Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                  )
                }
                className={inputClass}
              />
            </div>
          </fieldset>

          <fieldset className="rounded-2xl border border-border/60 p-4 sm:p-5">
            <legend className="px-2 text-sm font-semibold">Visual</legend>
            <div className="flex min-w-0 flex-col gap-4 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-32">
                {fields.image ? (
                  <StretchImage
                    src={imageLoadError ? PLACEHOLDER_IMAGE : fields.image}
                    alt="Stretch preview"
                    className="h-full w-full object-cover"
                    onError={() => setImageLoadError(true)}
                    sizes="128px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowImagePicker(true)}
                  aria-haspopup="dialog"
                  aria-expanded={showImagePicker}
                  className="min-h-11 w-full rounded-xl bg-primary/10 px-4 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Browse image library
                </button>
                <label htmlFor="stretch-image-url" className="sr-only">
                  Custom image URL
                </label>
                <input
                  id="stretch-image-url"
                  type="url"
                  value={fields.image}
                  onChange={(event) => {
                    setField("image", event.target.value);
                    setImageLoadError(false);
                  }}
                  placeholder="Or paste an image URL"
                  className={inputClass}
                />
                {fields.image && (
                  <button
                    type="button"
                    onClick={() => {
                      setField("image", "");
                      setImageLoadError(false);
                    }}
                    className="min-h-11 text-sm font-medium text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Remove image
                  </button>
                )}
                {imageLoadError && fields.image && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This image could not load. A placeholder will be used.
                  </p>
                )}
              </div>
            </div>
          </fieldset>
        </div>

        <fieldset className="min-w-0 space-y-5 rounded-2xl border border-border/60 p-4 sm:p-5">
          <legend className="px-2 text-sm font-semibold">Coaching cues</legend>
          <div>
            <label
              htmlFor="stretch-how"
              className="mb-2 block text-sm font-medium"
            >
              What to do
            </label>
            <textarea
              id="stretch-how"
              required
              rows={7}
              value={fields.how}
              onChange={(event) => setField("how", event.target.value)}
              placeholder="Use calm, concise movement cues."
              className={`${inputClass} resize-y`}
            />
          </div>
          <div>
            <label
              htmlFor="stretch-look-for"
              className="mb-2 block text-sm font-medium"
            >
              What to feel
            </label>
            <textarea
              id="stretch-look-for"
              required
              rows={6}
              value={fields.lookFor}
              onChange={(event) => setField("lookFor", event.target.value)}
              placeholder="Describe useful sensations and warning signs."
              className={`${inputClass} resize-y`}
            />
          </div>
          {stretch?.targetAreas?.length && (
            <p className="text-xs text-muted-foreground">
              Target areas are retained: {stretch.targetAreas.join(", ")}.
            </p>
          )}
        </fieldset>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 flex gap-3 border-t border-border bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-6 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
        <button
          type="button"
          onClick={requestCancel}
          className="min-h-11 flex-1 rounded-xl bg-secondary px-5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none"
        >
          {stretch ? "Save changes" : "Add stretch"}
        </button>
      </div>

      {showImagePicker && (
        <ImagePicker
          value={fields.image}
          onChange={(url) => {
            setField("image", url);
            setImageLoadError(false);
          }}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </form>
  );
}
