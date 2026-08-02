import type { ComponentProps, SyntheticEvent } from "react";

import { getResponsiveStretchImageSources, PLACEHOLDER_IMAGE } from "../images";

type StretchImageProps = Omit<
  ComponentProps<"img">,
  "alt" | "height" | "src" | "srcSet" | "width"
> & {
  alt: string;
  src: string;
};

export function StretchImage({
  alt,
  decoding = "async",
  fetchPriority,
  loading = "lazy",
  onError,
  sizes = "100vw",
  src,
  ...imageProps
}: StretchImageProps) {
  const responsiveSources = getResponsiveStretchImageSources(src);
  const width = responsiveSources?.width ?? 400;
  const height = responsiveSources?.height ?? 300;
  const priorityAttribute = fetchPriority
    ? { fetchpriority: fetchPriority }
    : {};

  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget
      .closest("picture")
      ?.querySelectorAll("source")
      .forEach((source) => source.remove());
    event.currentTarget.src = PLACEHOLDER_IMAGE;
    onError?.(event);
  };

  const image = (
    <img
      {...imageProps}
      {...priorityAttribute}
      alt={alt}
      decoding={decoding}
      height={height}
      loading={loading}
      onError={handleError}
      sizes={sizes}
      src={src}
      width={width}
    />
  );

  if (!responsiveSources) return image;

  return (
    <picture className="contents">
      <source srcSet={responsiveSources.avifSrcSet} type="image/avif" />
      <source srcSet={responsiveSources.webpSrcSet} type="image/webp" />
      {image}
    </picture>
  );
}
