import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import {
  getResponsiveStretchImageSources,
  STRETCH_IMAGES,
} from "../src/components/tools/Stretching/images";

describe("responsive stretch image sources", () => {
  test("maps a canonical local PNG to AVIF and WebP width candidates", () => {
    expect(getResponsiveStretchImageSources("/stretches/cat-pose.png")).toEqual(
      {
        avifSrcSet:
          "/stretches/generated/cat-pose-320w.avif 320w, /stretches/generated/cat-pose-640w.avif 640w, /stretches/generated/cat-pose-960w.avif 960w",
        height: 1086,
        webpSrcSet:
          "/stretches/generated/cat-pose-320w.webp 320w, /stretches/generated/cat-pose-640w.webp 640w, /stretches/generated/cat-pose-960w.webp 960w",
        width: 1448,
      },
    );
  });

  test("leaves custom and remote image URLs untouched", () => {
    expect(
      getResponsiveStretchImageSources("https://example.com/stretch.jpg"),
    ).toBeNull();
    expect(getResponsiveStretchImageSources("/custom/stretch.png")).toBeNull();
  });

  test("all catalog images and responsive candidates exist", () => {
    const imagePaths = new Set(
      Object.values(STRETCH_IMAGES).flatMap((routine) =>
        Object.values(routine),
      ),
    );

    for (const imagePath of imagePaths) {
      expect(existsSync(resolve("public", imagePath.slice(1)))).toBe(true);

      const responsiveSources = getResponsiveStretchImageSources(imagePath);
      expect(responsiveSources).not.toBeNull();

      for (const srcSet of [
        responsiveSources?.avifSrcSet,
        responsiveSources?.webpSrcSet,
      ]) {
        for (const candidate of srcSet?.split(", ") ?? []) {
          const [candidatePath] = candidate.split(" ");
          expect(existsSync(resolve("public", candidatePath.slice(1)))).toBe(
            true,
          );
        }
      }
    }
  });
});
