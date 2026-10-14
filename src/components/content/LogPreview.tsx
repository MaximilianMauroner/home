import type { PreviewEntry } from "./previewTypes";
import TagsList from "./TagsList";
import "./LogPreview.css";

interface LogPreviewProps {
  log: PreviewEntry;
}

export default function LogPreview({ log }: LogPreviewProps) {
  const href = `/dev-log/${log.id}/`;
  const releaseDate = new Date(log.data.releaseDate);
  return (
    <article className={`log-preview${log._imageUrl ? " log-preview--cover" : ""}`}>
      {log._imageUrl && (
        // The title and arrow links already name the entry, so the cover
        // stays out of the tab order and the accessibility tree.
        <a
          className="log-preview__cover"
          href={href}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={log._imageUrl}
            {...log._imageAttributes}
            alt=""
            loading="lazy"
            decoding="async"
          />
        </a>
      )}
      <div className="log-preview__date">
        <time dateTime={releaseDate.toISOString()}>
          {releaseDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </time>
        <span>{log.id.replace("/", " / ")}</span>
      </div>
      <div className="log-preview__copy">
        {log.data.tags[0] && (
          <span className="log-preview__topic">{log.data.tags[0]}</span>
        )}
        <h2>
          <a
            href={href}
            data-astro-prefetch="hover"
            style={{
              viewTransitionName: `devlog-title-${log.id.replaceAll("/", "-")}`,
            }}
          >
            {log.data.title}
          </a>
        </h2>
        <p>{log.data.description}</p>
        {log.data.tags.length > 0 && (
          <div className="log-preview__tags">
            <TagsList tags={log.data.tags} wrap />
          </div>
        )}
      </div>
      <a
        className="log-preview__arrow"
        href={href}
        aria-label={`Read ${log.data.title}`}
      >
        ↗
      </a>
    </article>
  );
}
