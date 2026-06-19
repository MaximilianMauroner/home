import type { ReadwiseItem } from "../utils/types";

export type AuthStatus = "unknown" | "authenticated" | "missing";
export type StatusTone = "success" | "error" | "info";

export interface StatusMessage {
  text: string;
  tone: StatusTone;
}

export interface FetchedDocument {
  doc: ReadwiseItem;
  tags: string[];
}
