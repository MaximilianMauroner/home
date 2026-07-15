import type { ReactNode } from "react";
import TagsList from "./TagsList";
import "./ContentPreview.css";

export type ContentFamily = "blog" | "log" | "snack";

interface ContentPreviewProps {
  family: ContentFamily;
  title: string;
  description: string;
  tags: string[];
  releaseDate: Date;
  href: string;
  entryId: string;
  titleTransitionId: string;
  image?: ReactNode;
  imageUrl?: string;
}

const familyDetails: Record<
  ContentFamily,
  { label: string; code: string; action: string; mark: string }
> = {
  blog: { label: "Blog", code: "BLG", action: "Follow trail", mark: "●" },
  log: { label: "Dev log", code: "LOG", action: "Open entry", mark: ">_" },
  snack: { label: "Snack", code: "SNK", action: "See more", mark: "✦" },
};

const normalizeEntryId = (entryId: string) => {
  const finalSegment = entryId.split("/").filter(Boolean).at(-1) ?? entryId;
  return finalSegment
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toUpperCase();
};

export default function ContentPreview({
  family,
  title,
  description,
  tags,
  releaseDate,
  href,
  entryId,
  titleTransitionId,
  image,
  imageUrl,
}: ContentPreviewProps) {
  const details = familyDetails[family];
  const date = releaseDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <article className={`content-preview content-preview--${family} group`}>
      <div className="content-preview__hardware" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <header className="content-preview__header">
        <span className="content-preview__family">
          <i aria-hidden="true" />
          {details.label}
        </span>
        <span className="content-preview__index" aria-label="Entry reference">
          {details.code}—{normalizeEntryId(entryId)}
        </span>
      </header>

      <div className="content-preview__visual" aria-hidden="true">
        {image ? (
          <div className="content-preview__image">{image}</div>
        ) : imageUrl ? (
          <img className="content-preview__image" src={imageUrl} alt="" />
        ) : null}
        <div className="content-preview__motif" />
        <div className="content-preview__contours">
          <i />
          <i />
          <i />
          <i />
        </div>
        <span className="content-preview__mark">{details.mark}</span>
      </div>

      <div className="content-preview__body">
        <time dateTime={releaseDate.toISOString()}>{date}</time>
        <h2>
          <a
            href={href}
            aria-label={`Open ${title}`}
            data-astro-prefetch="hover"
            style={{ viewTransitionName: titleTransitionId }}
          >
            {title}
          </a>
        </h2>
        <p>{description}</p>
      </div>

      <footer className="content-preview__footer">
        <div className="content-preview__tags">
          <TagsList tags={tags.slice(0, 4)} wrap />
        </div>
        <span className="content-preview__action" aria-hidden="true">
          {details.action} <b>↗</b>
        </span>
      </footer>
    </article>
  );
}
