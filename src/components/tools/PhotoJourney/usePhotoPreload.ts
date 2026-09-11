import { useEffect, useRef, useState } from "react";
import type { JourneyPhoto } from "./types";

type DecodableImage = { src: string; decode: () => Promise<void> };
export type PhotoPreloadStatus = "idle" | "loading" | "ready" | "error";

type QueueEntry = {
  image: DecodableImage;
  status: PhotoPreloadStatus;
  token: number;
};

const DECODE_TIMEOUT_MS = 4_000;

/** Retains a cancellation-safe decode window around the visible image. */
export class PhotoPreloadQueue {
  private entries = new Map<string, QueueEntry>();
  private listeners = new Set<() => void>();
  private nextToken = 0;

  constructor(
    private createImage: () => DecodableImage = () => new Image(),
    private decodeTimeoutMs = DECODE_TIMEOUT_MS,
  ) {}

  update(urls: readonly string[]) {
    const wanted = [...new Set(urls.filter(Boolean))].slice(0, 2);
    const wantedSet = new Set(wanted);
    for (const [url, entry] of this.entries) {
      if (wantedSet.has(url)) continue;
      entry.token = ++this.nextToken;
      entry.image.src = "";
      this.entries.delete(url);
    }
    for (const url of wanted) {
      if (this.entries.has(url)) continue;
      const image = this.createImage();
      const entry: QueueEntry = {
        image,
        status: "loading",
        token: ++this.nextToken,
      };
      this.entries.set(url, entry);
      image.src = url;
      void this.decode(url, entry);
    }
    this.notify();
  }

  statusFor(url?: string): PhotoPreloadStatus {
    return url ? this.entries.get(url)?.status ?? "idle" : "idle";
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear() {
    for (const entry of this.entries.values()) {
      entry.token = ++this.nextToken;
      entry.image.src = "";
    }
    this.entries.clear();
    this.notify();
  }

  private async decode(url: string, entry: QueueEntry) {
    const token = entry.token;
    try {
      await this.decodeWithin(url, entry.image);
      if (!this.current(url, entry, token)) return;
      entry.status = "ready";
    } catch {
      // A thumbnail remains visible after a failure or a bounded decode timeout.
      if (!this.current(url, entry, token)) return;
      entry.status = "error";
    }
    this.notify();
  }

  private current(url: string, entry: QueueEntry, token: number) {
    return this.entries.get(url) === entry && entry.token === token && entry.image.src === url;
  }

  private decodeWithin(url: string, image: DecodableImage) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([
      image.decode(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out decoding ${url}`)), this.decodeTimeoutMs);
      }),
    ]).finally(() => {
      if (timeout !== undefined) clearTimeout(timeout);
    });
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export function usePhotoPreload(photos: JourneyPhoto[], activeIndex: number) {
  const queueRef = useRef<PhotoPreloadQueue | null>(null);
  const [, update] = useState(0);
  if (!queueRef.current) queueRef.current = new PhotoPreloadQueue();
  const queue = queueRef.current;

  useEffect(() => queue.subscribe(() => update((version) => version + 1)), [queue]);
  useEffect(() => {
    queue.update(photos.slice(activeIndex, activeIndex + 2).map((photo) => photo.url));
  }, [queue, photos, activeIndex]);
  useEffect(() => () => queue.clear(), [queue]);

  return queue;
}
