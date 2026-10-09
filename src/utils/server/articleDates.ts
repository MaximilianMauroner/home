export type ArticleDates = {
  publishedAt: string;
  /** Known last change. Undefined when no reliable date exists. */
  modifiedAt?: string;
  /** Date for the visible "Updated" label, which falls back to release. */
  updatedAt: string;
};

export const getArticleDates = (
  releaseDate: Date | string,
  lastModified?: string,
): ArticleDates => {
  const published = new Date(releaseDate);
  const publishedAt = published.toISOString();
  // Content committed before its release date was unchanged when it went live.
  const modifiedAt = lastModified
    ? new Date(
        Math.max(new Date(lastModified).getTime(), published.getTime()),
      ).toISOString()
    : undefined;
  return { publishedAt, modifiedAt, updatedAt: modifiedAt ?? publishedAt };
};
