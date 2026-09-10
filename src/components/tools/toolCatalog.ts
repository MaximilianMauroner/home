export type ToolStatus = "stable" | "beta" | "experimental" | "inactive";
export type ToolPrivacy = "local" | "account";

export interface ToolMetadata {
  category: string;
  status: ToolStatus;
  featured: number;
  privacy: ToolPrivacy;
  access: string;
  labels: string[];
  tags: string[];
}

export const TOOL_CATALOG = {
  "ai-acceptability": {
    category: "reflection",
    status: "experimental",
    featured: 72,
    privacy: "local",
    access: "local",
    labels: ["local", "no account"],
    tags: ["ai", "quiz", "ethics"],
  },
  "ai-city-simulator": {
    category: "simulation",
    status: "experimental",
    featured: 70,
    privacy: "local",
    access: "local",
    labels: ["local", "no account"],
    tags: ["ai", "simulation", "economics"],
  },
  "colour-game": {
    category: "design",
    status: "stable",
    featured: 80,
    privacy: "local",
    access: "local",
    labels: ["local", "no account"],
    tags: ["color", "accessibility", "design"],
  },
  "microphone-tester": {
    category: "audio",
    status: "beta",
    featured: 65,
    privacy: "local",
    access: "local",
    labels: ["local", "microphone permission", "no account"],
    tags: ["audio", "microphone", "frequency", "decibel", "testing"],
  },
  leaveify: {
    category: "music",
    status: "beta",
    featured: 95,
    privacy: "account",
    access: "spotify/tidal",
    labels: ["Spotify", "TIDAL", "account required"],
    tags: ["music", "spotify", "tidal", "playlists"],
  },
  "malen-nach-zahlen": {
    category: "game",
    status: "inactive",
    featured: 0,
    privacy: "local",
    access: "local",
    labels: ["inactive"],
    tags: ["game", "color"],
  },
  "pace-calculator": {
    category: "fitness",
    status: "stable",
    featured: 60,
    privacy: "local",
    access: "local",
    labels: ["local", "no account"],
    tags: ["running", "fitness", "calculator"],
  },
  "photo-journey": {
    category: "photo",
    status: "experimental",
    featured: 82,
    privacy: "local",
    access: "local files",
    labels: ["local files", "no account"],
    tags: ["photos", "metadata", "map", "animation"],
  },
  "readwise-tags-mapper": {
    category: "reading",
    status: "beta",
    featured: 90,
    privacy: "account",
    access: "Readwise token",
    labels: ["Readwise", "account required"],
    tags: ["readwise", "reading", "tags"],
  },
  "spotify-stats": {
    category: "music",
    status: "stable",
    featured: 85,
    privacy: "account",
    access: "Spotify account",
    labels: ["Spotify", "account required"],
    tags: ["spotify", "music", "data-analysis"],
  },
  stretching: {
    category: "fitness",
    status: "stable",
    featured: 75,
    privacy: "local",
    access: "local",
    labels: ["local", "no account"],
    tags: ["stretching", "fitness", "routine"],
  },
  "whatsapp-stats": {
    category: "data",
    status: "stable",
    featured: 88,
    privacy: "local",
    access: "local file",
    labels: ["local file", "no account"],
    tags: ["whatsapp", "data-analysis", "privacy"],
  },
} satisfies Record<string, ToolMetadata>;

export type ToolSlug = keyof typeof TOOL_CATALOG;

export const INACTIVE_TOOL_SLUGS = new Set(
  Object.entries(TOOL_CATALOG)
    .filter(([, metadata]) => metadata.status === "inactive")
    .map(([slug]) => slug),
);

export function getToolMetadata(slug: string): ToolMetadata | undefined {
  return TOOL_CATALOG[slug as ToolSlug];
}

export function requireToolMetadata(slug: string): ToolMetadata {
  const metadata = getToolMetadata(slug);
  if (!metadata) {
    throw new Error(`Missing tool metadata for "${slug}".`);
  }
  return metadata;
}

export function getActiveToolCatalog() {
  return Object.entries(TOOL_CATALOG)
    .filter(([slug]) => isToolActive(slug))
    .map(([slug, metadata]) => ({ slug, ...metadata }));
}

export function isToolActive(slug: string) {
  return !INACTIVE_TOOL_SLUGS.has(slug);
}

export function isInactiveToolUrl(url: string) {
  const pathname = new URL(url).pathname;

  for (const slug of INACTIVE_TOOL_SLUGS) {
    if (pathname === `/tools/${slug}/` || pathname === `/tools/${slug}`) {
      return true;
    }
  }

  return false;
}
