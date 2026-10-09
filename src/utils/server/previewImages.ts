import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";
import type { PreviewEntry } from "@/components/content/previewTypes";

const images = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}",
);

export async function resolvePreviewImageUrl(image?: string) {
  const load = image ? images[image] : undefined;
  return load ? (await load()).default.src : undefined;
}

// This derivative set is used only by homepage timeline cards. Other routes
// keep their original covers and loading behavior.
export async function getHomepageCover(
  image?: string,
): Promise<Pick<PreviewEntry, "_imageUrl" | "_imageAttributes">> {
  const load = image ? images[image] : undefined;
  if (!load) return {};
  const source = (await load()).default;
  const widths = [384, 640, 960].filter((width) => width < source.width);
  if (!widths.includes(source.width) && source.width < 960)
    widths.push(source.width);
  const covers = await Promise.all(
    widths.map((width) =>
      getImage({ src: source, width, format: "webp", quality: 75 }),
    ),
  );
  return {
    _imageUrl: covers[0].src,
    _imageAttributes: {
      width: source.width,
      height: source.height,
      srcSet: covers
        .map((cover, index) => `${cover.src} ${widths[index]}w`)
        .join(", "),
      sizes:
        "(min-width: 1440px) 355px, (min-width: 1280px) calc((100vw - 376px) / 3), (min-width: 1024px) calc((100vw - 360px) / 2), (min-width: 768px) calc((100vw - 96px) / 2), (min-width: 640px) calc(100vw - 74px), calc(100vw - 66px)",
    },
  };
}
