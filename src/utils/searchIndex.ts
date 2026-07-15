import { toString } from "mdast-util-to-string";
import MiniSearch from "minisearch";
import type { Root, RootContent } from "mdast";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

import {
  POST_SEARCH_OPTIONS,
  type PostSearchDocument,
} from "@/utils/postSearch";

export type SearchPostSource = {
  body: string;
  collection: "blog" | "log" | "snacks";
  description: string;
  id: string;
  releaseDate: Date;
  tags: string[];
  title: string;
  url: string;
};

type TextSection = {
  heading: string;
  text: string;
};

const MAX_CHUNK_LENGTH = 850;
const parser = unified().use(remarkParse).use(remarkMdx);

const normalizeWhitespace = (value: string) =>
  value.replace(/\s+/g, " ").trim();

const splitLongText = (text: string) => {
  const chunks: string[] = [];
  let remaining = normalizeWhitespace(text);

  while (remaining.length > MAX_CHUNK_LENGTH) {
    const candidate = remaining.slice(0, MAX_CHUNK_LENGTH);
    const boundary = Math.max(
      candidate.lastIndexOf(". "),
      candidate.lastIndexOf("? "),
      candidate.lastIndexOf("! "),
      candidate.lastIndexOf("; "),
      candidate.lastIndexOf(" "),
    );
    const end =
      boundary > MAX_CHUNK_LENGTH * 0.55 ? boundary + 1 : MAX_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
};

const chunkSection = (heading: string, blocks: string[]): TextSection[] => {
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks.flatMap(splitLongText)) {
    if (current && current.length + block.length + 1 > MAX_CHUNK_LENGTH) {
      chunks.push(current);
      current = block;
    } else {
      current = current ? `${current} ${block}` : block;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((text) => ({ heading, text }));
};

const nodeText = (node: RootContent) => {
  if (
    node.type === "mdxjsEsm" ||
    node.type === "thematicBreak" ||
    node.type === "yaml"
  ) {
    return "";
  }
  return normalizeWhitespace(toString(node, { includeImageAlt: true }));
};

export const extractSearchSections = (body: string): TextSection[] => {
  const tree = parser.parse(body) as Root;
  const sections: TextSection[] = [];
  let heading = "";
  let blocks: string[] = [];

  const flush = () => {
    if (blocks.length > 0) sections.push(...chunkSection(heading, blocks));
    blocks = [];
  };

  for (const node of tree.children) {
    if (node.type === "heading") {
      flush();
      heading = normalizeWhitespace(toString(node));
      continue;
    }
    const text = nodeText(node);
    if (text) blocks.push(text);
  }
  flush();

  return sections;
};

export const buildPostSearchDocuments = (sources: SearchPostSource[]) =>
  sources.flatMap<PostSearchDocument>((source) => {
    const postKey = `${source.collection}:${source.id}`;
    const sections = extractSearchSections(source.body);
    const searchableSections =
      sections.length > 0
        ? sections
        : [{ heading: "", text: source.description }];

    return searchableSections.map((section, index) => ({
      body: section.text,
      description: source.description,
      heading: section.heading,
      id: `${postKey}:${index}`,
      postKey,
      releaseDate: source.releaseDate.toISOString(),
      tagsText: source.tags.join(" "),
      title: source.title,
      url: source.url,
    }));
  });

export const serializePostSearchIndex = (documents: PostSearchDocument[]) => {
  const index = new MiniSearch<PostSearchDocument>(POST_SEARCH_OPTIONS);
  index.addAll(documents);
  return JSON.stringify(index);
};
