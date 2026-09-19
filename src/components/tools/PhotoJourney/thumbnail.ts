export const THUMBNAIL_EDGE = 320;

import type { PhotoVisualFeatures } from "./types";

export type Preview = {
  url: string;
  width: number;
  height: number;
  dominantColor: string;
  visualFeatures: PhotoVisualFeatures;
};

/** Fits an image inside a square of `edge` pixels, keeping its ratio and never scaling up. */
export function thumbnailSize(
  width: number,
  height: number,
  edge = THUMBNAIL_EDGE,
) {
  const longest = Math.max(width, height);
  const scale = longest > edge ? edge / longest : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Builds the small preview used by the filmstrip and the map markers, so a 4 rem thumbnail does
 * not hold a full-resolution bitmap. `imageOrientation: "from-image"` applies the EXIF rotation;
 * the canvas default ignores it, which would leave portrait photos on their side. The returned
 * width and height are the rotated ones, so they match what the viewer sees.
 */
export async function createPreview(file: Blob): Promise<Preview> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  }).catch(() => {
    throw new Error("The browser could not decode this image.");
  });
  try {
    const size = thumbnailSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The browser could not prepare a preview.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob) throw new Error("The browser could not prepare a preview.");
    return {
      url: URL.createObjectURL(blob),
      dominantColor: sampleColor(context, size.width, size.height),
      visualFeatures: visualFeatures(context, size.width, size.height),
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

function visualFeatures(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): PhotoVisualFeatures {
  const sample = document.createElement("canvas");
  sample.width = 9;
  sample.height = 8;
  const small = sample.getContext("2d", { willReadFrequently: true });
  if (!small)
    return {
      signature: [],
      differenceHash: "",
      sharpness: 0,
      exposure: 0,
      composition: 0,
      colorfulness: 0,
    };
  small.drawImage(context.canvas, 0, 0, width, height, 0, 0, 9, 8);
  const pixels = small.getImageData(0, 0, 9, 8).data;
  const luminance: number[] = [];
  let hash = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const index = (y * 9 + x) * 4;
      luminance.push(
        (pixels[index] * 0.2126 +
          pixels[index + 1] * 0.7152 +
          pixels[index + 2] * 0.0722) /
          255,
      );
      if (x < 8)
        hash +=
          luminance.at(-1)! >
          (pixels[index + 4] * 0.2126 +
            pixels[index + 5] * 0.7152 +
            pixels[index + 6] * 0.0722) /
            255
            ? "1"
            : "0";
    }
  }
  const signature = Array.from({ length: 64 }, (_, index) => {
    const y = Math.floor(index / 8);
    const x = index % 8;
    return luminance[y * 9 + x];
  });
  const full = context.getImageData(0, 0, width, height).data;
  let light = 0;
  let clipped = 0;
  let color = 0;
  let edges = 0;
  let thirds = 0;
  let edgeSamples = 0;
  const stride = Math.max(1, Math.floor(Math.max(width, height) / 160));
  const lum = (x: number, y: number) => {
    const i = (Math.min(height - 1, y) * width + Math.min(width - 1, x)) * 4;
    return (
      (full[i] * 0.2126 + full[i + 1] * 0.7152 + full[i + 2] * 0.0722) / 255
    );
  };
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const value = lum(x, y);
      light += value;
      if (value < 0.02 || value > 0.98) clipped += 1;
      color +=
        (Math.abs(full[i] - full[i + 1]) +
          Math.abs(full[i + 1] - full[i + 2]) +
          Math.abs(full[i + 2] - full[i])) /
        (3 * 255);
      if (x + stride < width && y + stride < height) {
        const edge =
          Math.abs(value - lum(x + stride, y)) +
          Math.abs(value - lum(x, y + stride));
        edges += edge * edge;
        const nx = x / width;
        const ny = y / height;
        const nearThird =
          Math.min(Math.abs(nx - 1 / 3), Math.abs(nx - 2 / 3)) < 0.12 ||
          Math.min(Math.abs(ny - 1 / 3), Math.abs(ny - 2 / 3)) < 0.12;
        if (nearThird) thirds += edge * edge;
        edgeSamples += 1;
      }
    }
  }
  const samples = Math.ceil(width / stride) * Math.ceil(height / stride);
  const mean = light / samples;
  return {
    signature,
    differenceHash: hash,
    sharpness: edgeSamples ? edges / edgeSamples : 0,
    exposure: Math.max(0, 1 - Math.abs(mean - 0.5) * 1.35 - clipped / samples),
    composition: edges ? thirds / edges : 0,
    colorfulness: color / samples,
  };
}

/** Quantized modal colour avoids a muddy average of sky and ground. */
export function dominantColor(pixels: Uint8ClampedArray) {
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key =
      (pixels[i] >> 5) * 64 + (pixels[i + 1] >> 5) * 8 + (pixels[i + 2] >> 5);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let winner = 0,
    count = 0;
  for (const [key, total] of counts)
    if (total > count) {
      winner = key;
      count = total;
    }
  if (!count) return "#071319";
  return `rgb(${(winner >> 6) * 32 + 16}, ${((winner >> 3) & 7) * 32 + 16}, ${(winner & 7) * 32 + 16})`;
}
function sampleColor(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  return dominantColor(context.getImageData(0, 0, width, height).data);
}
