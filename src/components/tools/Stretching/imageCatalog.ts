export interface ImageCatalogItem {
  name: string;
  routines: string[];
  url: string;
}

type ImageSource = Record<string, Record<string, string>>;

function toLabel(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function buildImageCatalog(source: ImageSource): ImageCatalogItem[] {
  const byUrl = new Map<string, ImageCatalogItem>();

  for (const [routineKey, stretches] of Object.entries(source)) {
    const routine = toLabel(routineKey);
    for (const [stretchKey, url] of Object.entries(stretches)) {
      const existing = byUrl.get(url);
      if (existing) {
        if (!existing.routines.includes(routine))
          existing.routines.push(routine);
        continue;
      }
      byUrl.set(url, { name: toLabel(stretchKey), routines: [routine], url });
    }
  }

  return [...byUrl.values()];
}

export function filterImageCatalog(
  catalog: readonly ImageCatalogItem[],
  query: string,
  routine: string,
): ImageCatalogItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return catalog.filter((image) => {
    const matchesRoutine = !routine || image.routines.includes(routine);
    const haystack =
      `${image.name} ${image.routines.join(" ")}`.toLocaleLowerCase();
    return (
      matchesRoutine && (!normalizedQuery || haystack.includes(normalizedQuery))
    );
  });
}

export function getDraftSelection(
  current: string,
  selected: string | null,
): string {
  return selected ?? current;
}

export function isValidStretchImageSource(value: string): boolean {
  const source = value.trim();
  if (!source) return true;
  if (/^\/stretches\/[\w./-]+$/.test(source)) return true;

  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
