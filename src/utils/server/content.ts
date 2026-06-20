import { getCollection, type CollectionEntry } from "astro:content";
import {
  getActiveToolCatalog,
  getToolMetadata,
} from "@/components/tools/toolCatalog.mjs";

type ArticleCollection = "blog" | "log" | "snacks";
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

const collectionToKind: Record<ArticleCollection, ArticleKind> = {
  blog: "blog",
  log: "dev-log",
  snacks: "snacks",
};

const kindToPath: Record<ArticleKind, string> = {
  blog: "/blog/",
  "dev-log": "/dev-log/",
  snacks: "/snacks/",
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
  return collectionToKind[entry.collection as ArticleCollection];
};

const getEntryUrl = (entry: ArticleEntry) => {
  const kind = getEntryKind(entry);
  return `${kindToPath[kind]}${entry.id}/`;
};

const toAdjacentContentItem = (entry: ArticleEntry): AdjacentContentItem => ({
  title: entry.data.title,
  url: getEntryUrl(entry),
  kind: getEntryKind(entry),
  releaseDate: entry.data.releaseDate,
});

const getAllArticles = async (): Promise<ArticleEntry[]> => {
  const [blogs, logs, snacks] = await Promise.all([
    getBlogs(),
    getLogs(),
    getSnacks(),
  ]);
  return [...blogs, ...logs, ...snacks].sort(
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
  const blog = await getCollection("blog");
  const filteredBlog = blog.filter(filterFunction).sort((a, b) => {
    return (
      new Date(b.data.releaseDate).getTime() -
      new Date(a.data.releaseDate).getTime()
    );
  });
  return filteredBlog;
};

export type BlogType = CollectionEntry<"blog">;

export const getLogs = async (): Promise<CollectionEntry<"log">[]> => {
  const log = await getCollection("log");
  const filteredLog = log.filter(filterFunction).sort((a, b) => {
    return (
      new Date(b.data.releaseDate).getTime() -
      new Date(a.data.releaseDate).getTime()
    );
  });
  return filteredLog;
};

export type LogType = CollectionEntry<"log">;

export const getSnacks = async (): Promise<CollectionEntry<"snacks">[]> => {
  const snacks = await getCollection("snacks");
  const filteredSnacks = snacks.filter(filterFunction).sort((a, b) => {
    return (
      new Date(b.data.releaseDate).getTime() -
      new Date(a.data.releaseDate).getTime()
    );
  });
  return filteredSnacks;
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
      url: getEntryUrl(entry),
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
      description: `${getToolMetadata(tool.slug).category} tool`,
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
