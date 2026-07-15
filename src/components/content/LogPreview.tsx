import type { CollectionEntry } from "astro:content";
import type { ReactNode } from "react";
import ContentPreview from "./ContentPreview";

const localImageUrls = import.meta.glob<string>(
  "/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}",
  { eager: true, import: "default", query: "?url" },
);

interface LogPreviewProps {
  log: CollectionEntry<"log"> & { _imageUrl?: string };
  image?: ReactNode;
}

export default function LogPreview({ log, image }: LogPreviewProps) {
  const href = `/dev-log/${log.id}/`;
  const releaseDate = new Date(log.data.releaseDate);
  const titleTransitionId = `devlog-title-${log.id.replaceAll("/", "-")}`;
  const imageUrl =
    log._imageUrl ??
    (log.data.image ? localImageUrls[log.data.image] : undefined);

  return (
    <ContentPreview
      family="log"
      title={log.data.title}
      description={log.data.description}
      tags={log.data.tags}
      releaseDate={releaseDate}
      href={href}
      entryId={log.id}
      titleTransitionId={titleTransitionId}
      image={image}
      imageUrl={imageUrl}
    />
  );
}
