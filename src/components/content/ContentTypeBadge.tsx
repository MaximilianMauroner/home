import type { ContentKind } from "@/utils/types";

interface BadgeData {
  data: { type?: ContentKind; image?: string };
}

/**
 * Infers a content type from frontmatter: explicit `type` wins, otherwise
 * falls back to "image" when an image is set, else "essay".
 */
export function inferContentKind(entry: BadgeData): ContentKind {
  if (entry.data.type) return entry.data.type;
  if (entry.data.image && entry.data.image.trim() !== "") return "image";
  return "essay";
}

const STYLES: Record<ContentKind, { label: string; className: string; icon: string }> = {
  essay: {
    label: "essay",
    className:
      "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/30",
    icon: "✎",
  },
  link: {
    label: "link",
    className:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30",
    icon: "↗",
  },
  image: {
    label: "image",
    className:
      "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 ring-fuchsia-500/30",
    icon: "❏",
  },
  note: {
    label: "note",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    icon: "✦",
  },
};

export default function ContentTypeBadge({ kind }: { kind: ContentKind }) {
  const style = STYLES[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.65rem] font-medium uppercase tracking-wider ring-1 ring-inset ${style.className}`}
    >
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
