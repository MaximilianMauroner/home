import type { TaggedPreviewEntry } from "@/components/content/previewTypes";

type TopicHubSource = {
  intro: string;
  /** Ordered reading path as `collection:id` keys of published posts. */
  startHere: string[];
};

// Only curate topics that are already indexable (three or more posts).
const TOPIC_HUBS: Record<string, TopicHubSource> = {
  ai: {
    intro:
      "Essays and notes on working with AI: why agent-written code needs layered review, what agent work really costs, and how my 2019 predictions held up.",
    startHere: [
      "snacks:004-ai-coding",
      "blog:007-bugs-have-to-get-lucky-more-than-once",
      "blog:008-the-price-tag-isnt-the-cost-of-ai",
      "blog:006-ai-predictions-from-2019",
    ],
  },
  "developer-workflow": {
    intro:
      "How I work with coding agents: review their changes in layers, fix small friction with small tools, and check what the agent work really costs.",
    startHere: [
      "snacks:004-ai-coding",
      "blog:007-bugs-have-to-get-lucky-more-than-once",
      "snacks:006-codex-account-switch",
      "blog:008-the-price-tag-isnt-the-cost-of-ai",
    ],
  },
  obsidian: {
    intro:
      "My Obsidian setup as a personal CMS, the diary navigation templates built on top of it, and a bounty that could bring Notion exports into Obsidian.",
    startHere: [
      "blog:000-obsidian-as-a-cms",
      "log:2025/01",
      "snacks:000-notion-obsidian-port",
    ],
  },
};

export type TopicHub = {
  intro: string;
  startHere: TaggedPreviewEntry[];
};

/** Resolves a curated hub against the posts that exist in this build. */
export const getTopicHub = (
  tag: string,
  posts: TaggedPreviewEntry[],
): TopicHub | undefined => {
  const hub = TOPIC_HUBS[tag];
  if (!hub) return undefined;

  const postsByKey = new Map(
    posts.map((post) => [`${post.collection}:${post.id}`, post]),
  );
  const startHere = hub.startHere.map((key) => {
    const post = postsByKey.get(key);
    if (!post?.data.tags.includes(tag))
      throw new Error(
        `Topic hub "${tag}" lists "${key}", which is not a post tagged "${tag}".`,
      );
    return post;
  });
  return { intro: hub.intro, startHere };
};
