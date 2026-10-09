import type { ReactNode } from "react";
import ContentPreview from "./ContentPreview";
import type { PreviewEntry } from "./previewTypes";

export default function BlogPreview({
  blog,
  image,
}: {
  blog: PreviewEntry;
  image?: ReactNode;
}) {
  const href = `/blog/${blog.id}/`;
  const titleTransitionId = `blog-title-${blog.id.replaceAll("/", "-")}`;
  const releaseDate = new Date(blog.data.releaseDate);
  const imageUrl = blog._imageUrl;
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
      imageAttributes={blog._imageAttributes}
    />
  );
}
