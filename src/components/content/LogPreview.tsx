import type { CollectionEntry } from "astro:content";
import type { ReactNode } from "react";
import RelativeDate from "./RelativeDate";
import TagsList from "./TagsList";
import "./LogPreview.css";

interface LogPreviewProps {
  log: CollectionEntry<"log"> & { _imageUrl?: string };
  image?: ReactNode;
}

export default function LogPreview({ log, image }: LogPreviewProps) {
  const idParts = log.id.split("/").filter(Boolean);
  const entryId = idParts.at(-1) ?? "—";
  const year = idParts.at(0) ?? "—";
  const href = `/dev-log/${log.id}/`;
  const releaseDate = new Date(log.data.releaseDate);
  const hasImagePath = Boolean(log.data.image?.trim());
  const titleTransitionId = `devlog-title-${log.id.replaceAll("/", "-")}`;

  return (
    <article className="log-patchbay" data-log-id={log.id}>
      <span className="log-patchbay__screw log-patchbay__screw--tl" />
      <span className="log-patchbay__screw log-patchbay__screw--tr" />
      <span className="log-patchbay__screw log-patchbay__screw--bl" />
      <span className="log-patchbay__screw log-patchbay__screw--br" />

      <div className="log-patchbay__frame">
        <header className="log-patchbay__meta">
          <span>DEV / {year}.{entryId}</span>
          <time dateTime={releaseDate.toISOString()}>
            {releaseDate.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </header>

        <div className="log-patchbay__layout">
          <div className="log-patchbay__copy">
            <span className="log-patchbay__kicker">
              <i aria-hidden="true" /> Modular studio panel
            </span>

            <h2>
              <a
                href={href}
                data-astro-prefetch="hover"
                style={{ viewTransitionName: titleTransitionId }}
              >
                {log.data.title}
              </a>
            </h2>

            <p>{log.data.description}</p>

            <div className="log-patchbay__sockets">
              <TagsList tags={log.data.tags} />
            </div>

            <footer>
              <span className="log-patchbay__relative-date">
                <RelativeDate date={log.data.releaseDate} />
              </span>
              <a className="log-patchbay__open" href={href}>
                Open entry <span aria-hidden="true">↗</span>
              </a>
            </footer>
          </div>

          <figure className="log-patchbay__visual" aria-label="Entry image">
            {image ? (
              image
            ) : hasImagePath && log._imageUrl ? (
              <img src={log._imageUrl} alt={log.data.title} />
            ) : (
              <div className="log-patchbay__fallback" aria-hidden="true">
                <span>NO SIGNAL</span>
                <strong>{entryId.padStart(2, "0")}</strong>
              </div>
            )}
            <figcaption>Field attachment</figcaption>
          </figure>
        </div>
      </div>
    </article>
  );
}
