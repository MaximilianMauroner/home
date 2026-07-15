import type { CollectionEntry } from "astro:content";
import type { ReactNode } from "react";
import ContentPreview from "./ContentPreview";

export default function SnackPreview({
  snack,
  image,
}: {
  snack: CollectionEntry<"snacks">;
  image?: ReactNode;
}) {
  return (
    <ContentPreview
      family="snack"
      title={snack.data.title}
      description={snack.data.description}
      tags={snack.data.tags}
      releaseDate={new Date(snack.data.releaseDate)}
      href={`/snacks/${snack.id}/`}
      entryId={snack.id}
      titleTransitionId={`snack-title-${snack.id.replaceAll("/", "-")}`}
      image={image}
    />
  );
}
