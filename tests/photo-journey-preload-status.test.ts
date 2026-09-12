import { describe, expect, it, vi } from "vitest";
import { PhotoPreloadQueue } from "../src/components/tools/PhotoJourney/usePhotoPreload";

describe("PhotoPreloadQueue status", () => {
  it("marks failed decodes as a preview-safe error", async () => {
    const queue = new PhotoPreloadQueue(() => ({
      src: "",
      decode: async () => { throw new Error("bad pixels"); },
    }));

    queue.update(["broken"]);
    await vi.waitFor(() => expect(queue.statusFor("broken")).toBe("error"));
  });

  it("ignores a decode that resolves after its source was released", async () => {
    let releaseFirst: (() => void) | undefined;
    let images = 0;
    const queue = new PhotoPreloadQueue(() => {
      const image = {
        src: "",
        decode: () => {
          images += 1;
          return images === 1
            ? new Promise<void>((resolve) => { releaseFirst = resolve; })
            : Promise.resolve();
        },
      };
      return image;
    });

    queue.update(["first"]);
    queue.update(["second"]);
    releaseFirst?.();
    await vi.waitFor(() => expect(queue.statusFor("second")).toBe("ready"));

    expect(queue.statusFor("first")).toBe("idle");
  });

  it("falls back after a bounded decode wait", async () => {
    vi.useFakeTimers();
    const queue = new PhotoPreloadQueue(
      () => ({ src: "", decode: () => new Promise<void>(() => {}) }),
      20,
    );

    queue.update(["slow"]);
    await vi.advanceTimersByTimeAsync(20);

    expect(queue.statusFor("slow")).toBe("error");
    queue.clear();
    vi.useRealTimers();
  });
});
