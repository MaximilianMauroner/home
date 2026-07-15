import { getCollection, type CollectionEntry } from "astro:content";
import {
  getActiveToolCatalog,
  requireToolMetadata,
} from "@/components/tools/toolCatalog";
import type { OgCollection } from "@/utils/server/og";

export const ARTICLE_COLLECTIONS = [
  {
    collection: "blog",
    kind: "blog",
    pathPrefix: "/blog/",
    ogCollection: "blog",
  },
  {
    collection: "log",
    kind: "dev-log",
    pathPrefix: "/dev-log/",
    ogCollection: "dev-log",
  },
  {
    collection: "snacks",
    kind: "snacks",
    pathPrefix: "/snacks/",
    ogCollection: "snacks",
  },
] as const satisfies readonly {
  collection: "blog" | "log" | "snacks";
  kind: "blog" | "dev-log" | "snacks";
  pathPrefix: string;
  ogCollection: OgCollection;
}[];

export type ArticleCollection =
  (typeof ARTICLE_COLLECTIONS)[number]["collection"];
export type ArticleKind = "blog" | "dev-log" | "snacks";
type ArticleEntry =
  | CollectionEntry<"blog">
  | CollectionEntry<"log">
  | CollectionEntry<"snacks">;

export type RelatedItem = {
  kind: "blog" | "dev-log" | "snacks" | "tool";
  title: string;
  url: string;
  description?: string;
  tags?: string[];
};

export type AdjacentContentItem = {
  title: string;
  url: string;
  kind: ArticleKind;
  releaseDate: Date;
};

export type ArticleTrail = {
  previous?: AdjacentContentItem;
  next?: AdjacentContentItem;
  related: RelatedItem[];
};

const filterFunction = (
  post:
    | CollectionEntry<"blog">
    | CollectionEntry<"log">
    | CollectionEntry<"snacks">,
) =>
  import.meta.env.DEV ||
  (post.data.published && post.data.releaseDate < new Date());

const articleDescriptorFor = (collection: ArticleCollection) => {
  const descriptor = ARTICLE_COLLECTIONS.find(
    (candidate) => candidate.collection === collection,
  );
  if (!descriptor)
    throw new Error(`Unknown article collection "${collection}".`);
  return descriptor;
};

export const getArticleOgImagePath = (pathname: string) => {
  const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/$/, "");
  return `/og${normalizedPath}.png`;
};

export const getArticleOgImageUrl = (
  pathname: string,
  site: URL | string | undefined,
) =>
  new URL(getArticleOgImagePath(pathname), site ?? "https://www.mauroner.net")
    .href;

const getEntryKind = (entry: ArticleEntry): ArticleKind => {
  return articleDescriptorFor(entry.collection as ArticleCollection).kind;
};

export const getArticleUrl = (entry: ArticleEntry) => {
  const descriptor = articleDescriptorFor(
    entry.collection as ArticleCollection,
  );
  return `${descriptor.pathPrefix}${entry.id}/`;
};

const toAdjacentContentItem = (entry: ArticleEntry): AdjacentContentItem => ({
  title: entry.data.title,
  url: getArticleUrl(entry),
  kind: getEntryKind(entry),
  releaseDate: entry.data.releaseDate,
});

export const getArticlesByCollection = async (
  collection: ArticleCollection,
): Promise<ArticleEntry[]> => {
  const entries = await getCollection(collection);
  return (entries as ArticleEntry[])
    .filter(filterFunction)
    .sort(
      (a, b) =>
        new Date(b.data.releaseDate).getTime() -
        new Date(a.data.releaseDate).getTime(),
    );
};

export const getAllArticles = async (): Promise<ArticleEntry[]> => {
  const articleGroups = await Promise.all(
    ARTICLE_COLLECTIONS.map(({ collection }) =>
      getArticlesByCollection(collection),
    ),
  );
  return articleGroups
    .flat()
    .sort(
      (a, b) =>
        new Date(b.data.releaseDate).getTime() -
        new Date(a.data.releaseDate).getTime(),
    );
};

const scoreRelatedArticle = (
  current: ArticleEntry,
  candidate: ArticleEntry,
) => {
  const currentTags = new Set(current.data.tags);
  const tagOverlap = candidate.data.tags.filter((tag) =>
    currentTags.has(tag),
  ).length;
  if (tagOverlap === 0) return 0;

  const daysApart =
    Math.abs(
      candidate.data.releaseDate.getTime() - current.data.releaseDate.getTime(),
    ) /
    (1000 * 60 * 60 * 24);
  const recencyScore = Math.max(0, 1 - daysApart / 730);
  return tagOverlap * 10 + recencyScore;
};

const scoreRelatedTool = (current: ArticleEntry, tags: string[] = []) => {
  const currentTags = new Set(
    current.data.tags.map((tag) => tag.toLowerCase()),
  );
  const overlap = tags.filter((tag) =>
    currentTags.has(tag.toLowerCase()),
  ).length;
  return overlap * 10;
};

export const getBlogs = async () => {
  return getArticlesByCollection("blog") as Promise<CollectionEntry<"blog">[]>;
};

export type BlogType = CollectionEntry<"blog">;

export const getLogs = async (): Promise<CollectionEntry<"log">[]> => {
  return getArticlesByCollection("log") as Promise<CollectionEntry<"log">[]>;
};

export type LogType = CollectionEntry<"log">;

export const getSnacks = async (): Promise<CollectionEntry<"snacks">[]> => {
  return getArticlesByCollection("snacks") as Promise<
    CollectionEntry<"snacks">[]
  >;
};

export type SnackType = CollectionEntry<"snacks">;

export const getArticleTrail = async (
  collection: ArticleCollection,
  id: string,
): Promise<ArticleTrail> => {
  const articles = await getAllArticles();
  const current = articles.find(
    (entry) => entry.collection === collection && entry.id === id,
  );

  if (!current) {
    return { related: [] };
  }

  const sameCollection = articles
    .filter((entry) => entry.collection === collection)
    .sort(
      (a, b) =>
        new Date(a.data.releaseDate).getTime() -
        new Date(b.data.releaseDate).getTime(),
    );
  const currentIndex = sameCollection.findIndex((entry) => entry.id === id);

  const relatedArticles: RelatedItem[] = articles
    .filter((entry) => entry !== current)
    .map((entry) => ({
      entry,
      score: scoreRelatedArticle(current, entry),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        new Date(b.entry.data.releaseDate).getTime() -
        new Date(a.entry.data.releaseDate).getTime()
      );
    })
    .slice(0, 4)
    .map(({ entry }) => ({
      kind: getEntryKind(entry),
      title: entry.data.title,
      description: entry.data.description,
      url: getArticleUrl(entry),
      tags: entry.data.tags,
    }));

  const relatedTools: RelatedItem[] = getActiveToolCatalog()
    .map((tool) => ({
      tool,
      score: scoreRelatedTool(current, tool.tags),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.tool.featured - a.tool.featured;
    })
    .slice(0, 2)
    .map(({ tool }) => ({
      kind: "tool" as const,
      title: tool.slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      description: `${requireToolMetadata(tool.slug).category} tool`,
      url: `/tools/${tool.slug}/`,
      tags: tool.tags,
    }));

  return {
    previous:
      currentIndex > 0
        ? toAdjacentContentItem(sameCollection[currentIndex - 1])
        : undefined,
    next:
      currentIndex >= 0 && currentIndex < sameCollection.length - 1
        ? toAdjacentContentItem(sameCollection[currentIndex + 1])
        : undefined,
    related: [...relatedArticles, ...relatedTools].slice(0, 6),
  };
};

export const getTags = (
  blogs: CollectionEntry<"blog">[],
  logs: CollectionEntry<"log">[],
  snacks: CollectionEntry<"snacks">[],
) => {
  const tagCounts = new Map<string, number>();

  for (const fM of blogs) {
    fM.data.tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  }

  for (const fM of logs) {
    fM.data.tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  }

  for (const fM of snacks) {
    fM.data.tags.forEach((tag: string) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  }

  return tagCounts;
};
