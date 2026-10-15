import type { ContentKind } from "@/utils/types";

export interface PreviewEntry {
  _imageUrl?: string | null;
  _imageAttributes?: {
    width: number;
    height: number;
    srcSet: string;
    // The page that lays out the preview sets this for its own grid.
    sizes?: string;
  };
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
