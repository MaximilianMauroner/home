import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

import {
  extractMetadata,
  normalizeMetadata,
  sortPhotos,
} from "../src/components/tools/PhotoJourney/metadata";
import { thumbnailSize } from "../src/components/tools/PhotoJourney/thumbnail";
import type { JourneyPhoto } from "../src/components/tools/PhotoJourney/types";

describe("Photo Journey metadata", () => {
  test("extracts coordinates from a real geotagged JPEG", async () => {
    const fixturePath = fileURLToPath(
      new URL("./fixtures/geotagged-jpeg.b64", import.meta.url),
    );
    const encoded = await readFile(fixturePath, "utf8");
    // exifr takes a plain Uint8Array. A Node Buffer carries an ArrayBufferLike that no
    // longer satisfies that parameter type.
    const metadata = await extractMetadata(
      new Uint8Array(Buffer.from(encoded.trim(), "base64")),
    );
    expect(metadata.latitude).toBeCloseTo(-0.3713, 4);
    expect(metadata.longitude).toBeCloseTo(36.05642, 4);
  });

  test("normalizes valid GPS and camera settings, including zero coordinates", () => {
    const result = normalizeMetadata(
      {
        name: "photo.jpg",
        size: 2_000_000,
        type: "image/jpeg",
        lastModified: new Date("2024-01-01").valueOf(),
      },
      {
        latitude: 0,
        longitude: 0,
        Make: "Apple",
        Model: "iPhone",
        FNumber: 1.8,
        ExposureTime: 1 / 120,
        FocalLength: 24,
        ISO: 64,
      },
      4032,
      3024,
    );
    expect(result.coordinates).toEqual({ latitude: 0, longitude: 0 });
    expect(result).toMatchObject({
      camera: "Apple iPhone",
      aperture: "f/1.8",
      shutterSpeed: "1/120 s",
      focalLength: "24 mm",
      iso: "ISO 64",
      dimensions: "4032 × 3024",
      fileSize: "1.9 MB",
      fileType: "JPEG",
    });
  });

  test("rejects invalid coordinates", () => {
    expect(
      normalizeMetadata(
        { name: "bad.jpg", size: 100, type: "image/jpeg", lastModified: 0 },
        { latitude: 91, longitude: 181 },
        1,
        1,
      ).coordinates,
    ).toBeUndefined();
  });

  test("orders dated photos first and preserves import order without dates", () => {
    const makePhoto = (importOrder: number, capturedAt?: Date) =>
      ({ importOrder, metadata: { capturedAt } }) as JourneyPhoto;
    expect(
      sortPhotos([
        makePhoto(2),
        makePhoto(1),
        makePhoto(0, new Date("2024-01-01")),
      ]).map((item) => item.importOrder),
    ).toEqual([0, 1, 2]);
  });
});

describe("Photo Journey previews", () => {
  test("scales the longest edge down to the thumbnail size", () => {
    expect(thumbnailSize(4032, 3024)).toEqual({ width: 320, height: 240 });
    expect(thumbnailSize(3024, 4032)).toEqual({ width: 240, height: 320 });
  });

  test("never scales an image up", () => {
    expect(thumbnailSize(120, 90)).toEqual({ width: 120, height: 90 });
  });

  test("keeps a very thin image at least one pixel wide", () => {
    expect(thumbnailSize(4000, 3).height).toBe(1);
  });
});
