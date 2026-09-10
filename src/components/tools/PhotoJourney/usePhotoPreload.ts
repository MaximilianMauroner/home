import { useEffect, useRef } from "react";
import type { JourneyPhoto } from "./types";

type DecodableImage = { src: string; decode: () => Promise<void> };

/** Retain only the active and next decoded originals, in playback order. */
export class PhotoPreloadQueue {
  private images = new Map<string, DecodableImage>();
  constructor(private createImage: () => DecodableImage = () => new Image()) {}

  update(urls: string[]) {
    const wanted = [...new Set(urls)].slice(0, 2);
    for (const [url, image] of this.images) {
      if (!wanted.includes(url)) {
        image.src = "";
        this.images.delete(url);
      }
    }
    for (const url of wanted) {
      if (this.images.has(url)) continue;
      const image = this.createImage();
      this.images.set(url, image);
      image.src = url;
      // A decode failure must not stop playback; the visible image handles loading.
      void image.decode().catch(() => {});
    }
  }

  clear() {
    for (const image of this.images.values()) image.src = "";
    this.images.clear();
  }
}

export function usePhotoPreload(photos: JourneyPhoto[], activeIndex: number) {
  const queue = useRef<PhotoPreloadQueue>();
  useEffect(() => {
    queue.current ??= new PhotoPreloadQueue();
    queue.current.update(
      photos.slice(activeIndex, activeIndex + 2).map((photo) => photo.url),
    );
  }, [photos, activeIndex]);
  useEffect(() => () => queue.current?.clear(), []);
}
