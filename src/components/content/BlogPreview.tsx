import type { CollectionEntry } from "astro:content";
import type { ReactNode } from "react";
import ContentPreview from "./ContentPreview";

const localImageUrls = import.meta.glob<string>(
  "/src/assets/**/*.{jpeg,jpg,png,gif,webp,avif}",
  { eager: true, import: "default", query: "?url" },
);

type BlogPreviewEntry = CollectionEntry<"blog"> & { _imageUrl?: string | null };

export default function BlogPreview({
  blog,
  image,
}: {
  blog: BlogPreviewEntry;
  image?: ReactNode;
}) {
  const href = `/blog/${blog.id}/`;
  const titleTransitionId = `blog-title-${blog.id}`;
  const releaseDate = new Date(blog.data.releaseDate);
  const imageUrl =
    blog._imageUrl ??
    (blog.data.image ? localImageUrls[blog.data.image] : undefined);
  return (
    <ContentPreview
      family="blog"
      title={blog.data.title}
      description={blog.data.description}
      tags={blog.data.tags}
      releaseDate={releaseDate}
      href={href}
      entryId={blog.id}
      titleTransitionId={titleTransitionId}
      image={image}
      imageUrl={imageUrl ?? undefined}
    />
  );
}
