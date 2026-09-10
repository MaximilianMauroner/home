export const THUMBNAIL_EDGE = 320;

export type Preview = { url: string; width: number; height: number; dominantColor: string };

/** Fits an image inside a square of `edge` pixels, keeping its ratio and never scaling up. */
export function thumbnailSize(width: number, height: number, edge = THUMBNAIL_EDGE) {
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
      width: bitmap.width,
      height: bitmap.height,
    };
  } finally {
    bitmap.close();
  }
}

/** Quantized modal colour avoids a muddy average of sky and ground. */
export function dominantColor(pixels: Uint8ClampedArray) {
  const counts = new Map<number, number>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key = (pixels[i] >> 5) * 64 + (pixels[i + 1] >> 5) * 8 + (pixels[i + 2] >> 5);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let winner = 0, count = 0;
  for (const [key, total] of counts) if (total > count) { winner = key; count = total; }
  if (!count) return '#071319';
  return `rgb(${(winner >> 6) * 32 + 16}, ${((winner >> 3) & 7) * 32 + 16}, ${(winner & 7) * 32 + 16})`;
}
function sampleColor(context: CanvasRenderingContext2D, width: number, height: number) {
  return dominantColor(context.getImageData(0, 0, width, height).data);
}
