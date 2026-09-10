import { describe, expect, it } from "vitest";
import { PhotoPreloadQueue } from "../src/components/tools/PhotoJourney/usePhotoPreload";

describe("photo decode queue", () => {
  it("decodes in order, reuses the next photo, and releases stale originals", () => {
    const decoded: string[] = [];
    const images: Array<{ src: string; decode: () => Promise<void> }> = [];
    const queue = new PhotoPreloadQueue(() => {
      const image = {
        src: "",
        decode: async () => {
          decoded.push(image.src);
        },
      };
      images.push(image);
      return image;
    });
    queue.update(["a", "b", "c"]);
    expect(decoded).toEqual(["a", "b"]);
    queue.update(["b", "c"]);
    expect(decoded).toEqual(["a", "b", "c"]);
    expect(images[0].src).toBe("");
    queue.update(["x", "y"]);
    expect(images.slice(0, 3).map((image) => image.src)).toEqual(["", "", ""]);
    queue.clear();
    expect(images.every((image) => image.src === "")).toBe(true);
  });

  it("deduplicates sources and tolerates decode failures", async () => {
    let count = 0;
    const queue = new PhotoPreloadQueue(() => ({
      src: "",
      decode: async () => {
        count++;
        throw new Error("bad pixels");
      },
    }));
    queue.update(["a", "a"]);
    await Promise.resolve();
    expect(count).toBe(1);
    queue.clear();
  });
});
