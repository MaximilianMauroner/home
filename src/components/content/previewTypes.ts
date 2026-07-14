import type { ContentKind } from "@/utils/types";

export interface PreviewEntry {
  _imageUrl?: string | null;
  data: {
    description: string;
    image?: string;
    releaseDate: Date | string;
    tags: string[];
    title: string;
    type?: ContentKind;
  };
  id: string;
}

export interface TaggedPreviewEntry extends PreviewEntry {
  collection: "blog" | "log" | "snacks";
}
