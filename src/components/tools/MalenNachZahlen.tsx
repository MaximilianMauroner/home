import React, { useState, useRef, useCallback } from "react";

interface ColorRegion {
  id: number;
  color: string;
  pixels: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

interface ColorPalette {
  [key: number]: string;
}

export default function MalenNachZahlen() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [colorRegions, setColorRegions] = useState<ColorRegion[]>([]);
  const [colorPalette, setColorPalette] = useState<ColorPalette>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [showBorders, setShowBorders] = useState(false);
  const [colorCount, setColorCount] = useState(8);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert RGB to hex
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // Convert RGB to HSL
  const rgbToHsl = (
    r: number,
    g: number,
    b: number,
  ): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return [h * 360, s * 100, l * 100];
  };

  // Convert HSL to RGB
  const hslToRgb = (
    h: number,
    s: number,
    l: number,
  ): [number, number, number] => {
    h /= 360;
    s /= 100;
    l /= 100;

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  // Enhance color saturation
  const enhanceColor = (
    r: number,
    g: number,
    b: number,
    saturationBoost: number = 1.3,
  ): [number, number, number] => {
    const [h, s, l] = rgbToHsl(r, g, b);

    // Boost saturation while keeping it within bounds
    const newS = Math.min(100, s * saturationBoost);

    // Slightly adjust lightness for better contrast
    const newL =
      l > 70 ? Math.max(30, l - 10) : l < 30 ? Math.min(70, l + 10) : l;

    return hslToRgb(h, newS, newL);
  };

  // Detect background color (most common edge color)
  const detectBackgroundColor = (
    imageData: ImageData,
  ): [number, number, number] => {
    const width = imageData.width;
    const height = imageData.height;
    const edgeColors: { [key: string]: number } = {};

    // Sample edge pixels
    for (let x = 0; x < width; x++) {
      // Top edge
      const topIndex = x * 4;
      const topColor = `${imageData.data[topIndex]},${imageData.data[topIndex + 1]},${imageData.data[topIndex + 2]}`;
      edgeColors[topColor] = (edgeColors[topColor] || 0) + 1;

      // Bottom edge
      const bottomIndex = ((height - 1) * width + x) * 4;
      const bottomColor = `${imageData.data[bottomIndex]},${imageData.data[bottomIndex + 1]},${imageData.data[bottomIndex + 2]}`;
      edgeColors[bottomColor] = (edgeColors[bottomColor] || 0) + 1;
    }

    for (let y = 0; y < height; y++) {
      // Left edge
      const leftIndex = y * width * 4;
      const leftColor = `${imageData.data[leftIndex]},${imageData.data[leftIndex + 1]},${imageData.data[leftIndex + 2]}`;
      edgeColors[leftColor] = (edgeColors[leftColor] || 0) + 1;

      // Right edge
      const rightIndex = (y * width + width - 1) * 4;
      const rightColor = `${imageData.data[rightIndex]},${imageData.data[rightIndex + 1]},${imageData.data[rightIndex + 2]}`;
      edgeColors[rightColor] = (edgeColors[rightColor] || 0) + 1;
    }

    // Find most common edge color
    let maxCount = 0;
    let bgColor = [255, 255, 255];

    Object.entries(edgeColors).forEach(([colorStr, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bgColor = colorStr.split(",").map(Number);
      }
    });

    return bgColor as [number, number, number];
  };

  // Calculate color distance
  const colorDistance = (
    color1: [number, number, number],
    color2: [number, number, number],
  ): number => {
    const dr = color1[0] - color2[0];
    const dg = color1[1] - color2[1];
    const db = color1[2] - color2[2];
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  // K-means clustering for color quantization with background handling
  const quantizeColors = (
    imageData: ImageData,
    k: number,
    backgroundColor: [number, number, number],
  ): [number, number, number][] => {
    const pixels: [number, number, number][] = [];

    // Sample pixels (every 4th pixel to reduce computation)
    // Filter out background-like colors
    for (let i = 0; i < imageData.data.length; i += 16) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      // Skip pixels that are too similar to background
      const bgDistance = colorDistance([r, g, b], backgroundColor);
      if (bgDistance > 30) {
        // Only include non-background pixels
        // Enhance the color before clustering
        const [enhancedR, enhancedG, enhancedB] = enhanceColor(r, g, b);
        pixels.push([enhancedR, enhancedG, enhancedB]);
      }
    }

    // If we don't have enough non-background pixels, fall back to all pixels
    if (pixels.length < k * 10) {
      pixels.length = 0;
      for (let i = 0; i < imageData.data.length; i += 16) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const [enhancedR, enhancedG, enhancedB] = enhanceColor(r, g, b);
        pixels.push([enhancedR, enhancedG, enhancedB]);
      }
    }

    // Initialize centroids randomly
    let centroids: [number, number, number][] = [];
    for (let i = 0; i < k; i++) {
      const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
      centroids.push([...randomPixel]);
    }

    // K-means iterations
    for (let iter = 0; iter < 15; iter++) {
      // Increased iterations for better convergence
      const clusters: [number, number, number][][] = Array(k)
        .fill(null)
        .map(() => []);

      // Assign pixels to nearest centroid
      pixels.forEach((pixel) => {
        let minDistance = Infinity;
        let closestCentroid = 0;

        centroids.forEach((centroid, index) => {
          const distance = colorDistance(pixel, centroid);
          if (distance < minDistance) {
            minDistance = distance;
            closestCentroid = index;
          }
        });

        clusters[closestCentroid].push(pixel);
      });

      // Update centroids
      centroids = clusters.map((cluster, index) => {
        if (cluster.length === 0) return centroids[index]; // Keep previous centroid

        const sum = cluster.reduce(
          (acc, pixel) => [
            acc[0] + pixel[0],
            acc[1] + pixel[1],
            acc[2] + pixel[2],
          ],
          [0, 0, 0],
        );

        return [
          Math.round(sum[0] / cluster.length),
          Math.round(sum[1] / cluster.length),
          Math.round(sum[2] / cluster.length),
        ];
      });
    }

    // Add background color back if it's not already represented
    const hasBackground = centroids.some(
      (centroid) => colorDistance(centroid, backgroundColor) < 50,
    );

    if (!hasBackground && centroids.length < k) {
      centroids.push(backgroundColor);
    }

    return centroids;
  };

  // Find connected components using flood fill with background filtering
  const findConnectedComponents = (
    imageData: ImageData,
    quantizedColors: [number, number, number][],
    backgroundColor: [number, number, number],
  ): ColorRegion[] => {
    const width = imageData.width;
    const height = imageData.height;
    const visited = new Array(width * height).fill(false);
    const regions: ColorRegion[] = [];
    let regionId = 1;

    const getClosestColor = (
      r: number,
      g: number,
      b: number,
    ): [number, number, number] => {
      let minDistance = Infinity;
      let closestColor = quantizedColors[0];

      quantizedColors.forEach((color) => {
        const distance = colorDistance([r, g, b], color);
        if (distance < minDistance) {
          minDistance = distance;
          closestColor = color;
        }
      });

      return closestColor;
    };

    const isBackgroundColor = (color: [number, number, number]): boolean => {
      return colorDistance(color, backgroundColor) < 40;
    };

    const floodFill = (
      startX: number,
      startY: number,
      targetColor: [number, number, number],
    ): { x: number; y: number }[] => {
      const stack = [{ x: startX, y: startY }];
      const component: { x: number; y: number }[] = [];

      while (stack.length > 0) {
        const { x, y } = stack.pop()!;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;

        const index = y * width + x;
        if (visited[index]) continue;

        const pixelIndex = index * 4;
        const pixelColor = getClosestColor(
          imageData.data[pixelIndex],
          imageData.data[pixelIndex + 1],
          imageData.data[pixelIndex + 2],
        );

        // Use tighter tolerance for background colors, looser for foreground
        const tolerance = isBackgroundColor(targetColor) ? 5 : 15;
        if (colorDistance(pixelColor, targetColor) > tolerance) continue;

        visited[index] = true;
        component.push({ x, y });

        // Add neighbors
        stack.push({ x: x + 1, y });
        stack.push({ x: x - 1, y });
        stack.push({ x, y: y + 1 });
        stack.push({ x, y: y - 1 });
      }

      return component;
    };

    // Create a map to track regions by color
    const colorToRegion = new Map<string, ColorRegion>();

    // Find all connected components but merge by color
    for (let y = 0; y < height; y += 1) {
      // Check every pixel for better accuracy
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (visited[index]) continue;

        const pixelIndex = index * 4;
        const pixelColor = getClosestColor(
          imageData.data[pixelIndex],
          imageData.data[pixelIndex + 1],
          imageData.data[pixelIndex + 2],
        );

        const component = floodFill(x, y, pixelColor);

        // Use different minimum sizes for background vs foreground
        const isBackground = isBackgroundColor(pixelColor);
        const minSize = isBackground ? 200 : 50; // Increased minimum sizes

        if (component.length > minSize) {
          const colorKey = rgbToHex(
            pixelColor[0],
            pixelColor[1],
            pixelColor[2],
          );

          if (colorToRegion.has(colorKey)) {
            // Merge with existing region of same color
            const existingRegion = colorToRegion.get(colorKey)!;
            existingRegion.pixels.push(...component);

            // Recalculate center
            existingRegion.centerX =
              existingRegion.pixels.reduce((sum, p) => sum + p.x, 0) /
              existingRegion.pixels.length;
            existingRegion.centerY =
              existingRegion.pixels.reduce((sum, p) => sum + p.y, 0) /
              existingRegion.pixels.length;
          } else {
            // Create new region
            const centerX =
              component.reduce((sum, p) => sum + p.x, 0) / component.length;
            const centerY =
              component.reduce((sum, p) => sum + p.y, 0) / component.length;

            const newRegion: ColorRegion = {
              id: regionId++,
              color: colorKey,
              pixels: component,
              centerX,
              centerY,
            };

            colorToRegion.set(colorKey, newRegion);
            regions.push(newRegion);
          }
        }
      }
    }

    // Limit the number of regions to approximately match the color count
    const maxRegions = Math.min(quantizedColors.length + 2, regions.length);
    return regions
      .sort((a, b) => b.pixels.length - a.pixels.length) // Sort by size, largest first
      .slice(0, maxRegions); // Take only the largest regions
  };

  const processImage = useCallback(
    async (imageSrc: string) => {
      if (!canvasRef.current) return;

      setIsProcessing(true);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();

      img.onload = () => {
        // Resize image for better performance
        const maxWidth = 400;
        const maxHeight = 400;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);

        // Detect background color
        const backgroundColor = detectBackgroundColor(imageData);

        // Quantize colors
        const quantizedColors = quantizeColors(
          imageData,
          colorCount,
          backgroundColor,
        );

        // Find connected components
        const regions = findConnectedComponents(
          imageData,
          quantizedColors,
          backgroundColor,
        );

        // Create color palette
        const palette: ColorPalette = {};
        regions.forEach((region) => {
          palette[region.id] = region.color;
        });

        // Create reference data for edge detection (always use quantized colors)
        const referenceImageData = new ImageData(width, height);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];

          // Find closest quantized color
          let minDistance = Infinity;
          let closestColor = quantizedColors[0];

          quantizedColors.forEach((color) => {
            const distance = colorDistance([r, g, b], color);
            if (distance < minDistance) {
              minDistance = distance;
              closestColor = color;
            }
          });

          referenceImageData.data[i] = closestColor[0];
          referenceImageData.data[i + 1] = closestColor[1];
          referenceImageData.data[i + 2] = closestColor[2];
          referenceImageData.data[i + 3] = 255;
        }

        // Create border detection data
        const borderData = new ImageData(width, height);
        // Initialize border data with transparent pixels
        for (let i = 0; i < borderData.data.length; i += 4) {
          borderData.data[i] = 0; // R
          borderData.data[i + 1] = 0; // G
          borderData.data[i + 2] = 0; // B
          borderData.data[i + 3] = 0; // A (transparent)
        }

        // Find edges by comparing adjacent pixels
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const currentIndex = (y * width + x) * 4;
            const currentColor = [
              referenceImageData.data[currentIndex],
              referenceImageData.data[currentIndex + 1],
              referenceImageData.data[currentIndex + 2],
            ];

            // Check 4-connected neighbors
            const neighbors = [
              { dx: 0, dy: -1 }, // top
              { dx: 1, dy: 0 }, // right
              { dx: 0, dy: 1 }, // bottom
              { dx: -1, dy: 0 }, // left
            ];

            let isEdge = false;
            for (const { dx, dy } of neighbors) {
              const neighborX = x + dx;
              const neighborY = y + dy;

              if (
                neighborX >= 0 &&
                neighborX < width &&
                neighborY >= 0 &&
                neighborY < height
              ) {
                const neighborIndex = (neighborY * width + neighborX) * 4;
                const neighborColor = [
                  referenceImageData.data[neighborIndex],
                  referenceImageData.data[neighborIndex + 1],
                  referenceImageData.data[neighborIndex + 2],
                ];

                // If neighbor color is different enough, this is an edge
                if (
                  colorDistance(
                    currentColor as [number, number, number],
                    neighborColor as [number, number, number],
                  ) > 15
                ) {
                  isEdge = true;
                  break;
                }
              }
            }

            if (isEdge) {
              // Draw a thicker border by setting multiple pixels
              const borderThickness = 1;
              for (let dy = -borderThickness; dy <= borderThickness; dy++) {
                for (let dx = -borderThickness; dx <= borderThickness; dx++) {
                  const borderX = x + dx;
                  const borderY = y + dy;

                  if (
                    borderX >= 0 &&
                    borderX < width &&
                    borderY >= 0 &&
                    borderY < height
                  ) {
                    const borderIndex = (borderY * width + borderX) * 4;
                    borderData.data[borderIndex] = 0; // R
                    borderData.data[borderIndex + 1] = 0; // G
                    borderData.data[borderIndex + 2] = 0; // B
                    borderData.data[borderIndex + 3] = 255; // A (opaque)
                  }
                }
              }
            }
          }
        }

        // Create final image based on showBorders toggle
        const newImageData = new ImageData(width, height);

        if (showBorders) {
          // Borders only mode: white background with black borders
          for (let i = 0; i < newImageData.data.length; i += 4) {
            if (borderData.data[i + 3] > 0) {
              // Border pixel - make it black
              newImageData.data[i] = 0; // R
              newImageData.data[i + 1] = 0; // G
              newImageData.data[i + 2] = 0; // B
              newImageData.data[i + 3] = 255; // A
            } else {
              // Non-border pixel - make it white
              newImageData.data[i] = 255; // R
              newImageData.data[i + 1] = 255; // G
              newImageData.data[i + 2] = 255; // B
              newImageData.data[i + 3] = 255; // A
            }
          }
        } else {
          // Colors only mode: enhanced quantized colors without borders
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];

            // Find closest quantized color
            let minDistance = Infinity;
            let closestColor = quantizedColors[0];

            quantizedColors.forEach((color) => {
              const distance = colorDistance([r, g, b], color);
              if (distance < minDistance) {
                minDistance = distance;
                closestColor = color;
              }
            });

            // Apply additional enhancement to the final color
            const [finalR, finalG, finalB] = enhanceColor(
              closestColor[0],
              closestColor[1],
              closestColor[2],
              1.2,
            );

            newImageData.data[i] = finalR;
            newImageData.data[i + 1] = finalG;
            newImageData.data[i + 2] = finalB;
            newImageData.data[i + 3] = 255;
          }
        }

        ctx.putImageData(newImageData, 0, 0);

        setProcessedImage(canvas.toDataURL());
        setColorRegions(regions);
        setColorPalette(palette);
        setIsProcessing(false);
      };

      img.src = imageSrc;
    },
    [colorCount, showBorders],
  );

  const handleImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageSrc = e.target?.result as string;
        setUploadedImage(imageSrc);
        processImage(imageSrc);
      };
      reader.readAsDataURL(file);
    },
    [processImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageSrc = event.target?.result as string;
          setUploadedImage(imageSrc);
          processImage(imageSrc);
        };
        reader.readAsDataURL(file);
      }
    },
    [processImage],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold">Malen Nach Zahlen Generator</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Upload an image to convert it into a color-by-numbers drawing
        </p>
      </div>

      {/* Upload Area */}
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 shadow-sm dark:border-gray-600 dark:bg-gray-900/50">
        <div
          className="cursor-pointer text-center"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700">
              <svg
                className="h-8 w-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium">
                Drop an image here or click to upload
              </p>
              <p className="text-sm text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      {/* Controls */}
      {uploadedImage && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium">Colors:</label>
              <input
                type="range"
                min="4"
                max="265"
                value={colorCount}
                onChange={(e) => setColorCount(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm">{colorCount}</span>
            </div>

            <button
              onClick={() => processImage(uploadedImage)}
              disabled={isProcessing}
              className="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {isProcessing ? "Processing..." : "Reprocess"}
            </button>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setShowNumbers(e.target.checked)}
              />
              <span className="text-sm">Show Numbers</span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={showBorders}
                onChange={(e) => {
                  setShowBorders(e.target.checked);
                  // Reprocess image when borders toggle changes
                  if (uploadedImage) {
                    processImage(uploadedImage);
                  }
                }}
              />
              <span className="text-sm">Borders Only</span>
            </label>
          </div>
        </div>
      )}

      {/* Results */}
      {uploadedImage && (
        <div className="grid grid-cols-1 gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:grid-cols-2 dark:border-gray-700 dark:bg-gray-900">
          {/* Original Image */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Original Image</h3>
            <div className="overflow-hidden rounded-lg border-2 border-gray-300 shadow-sm dark:border-gray-600">
              <img
                src={uploadedImage}
                alt="Original"
                className="h-auto max-h-96 w-full object-contain"
              />
            </div>
          </div>

          {/* Processed Image */}
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Color by Numbers</h3>
            <div className="relative overflow-hidden rounded-lg border-2 border-gray-300 shadow-sm dark:border-gray-600">
              {processedImage && (
                <div className="relative">
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="h-auto max-h-96 w-full object-contain"
                  />

                  {/* Number Overlays */}
                  {showNumbers && colorRegions.length > 0 && (
                    <div className="absolute inset-0">
                      {colorRegions.map((region) => (
                        <div
                          key={region.id}
                          className="absolute rounded bg-black bg-opacity-50 px-1 text-xs font-bold text-white"
                          style={{
                            left: `${(region.centerX / (canvasRef.current?.width || 1)) * 100}%`,
                            top: `${(region.centerY / (canvasRef.current?.height || 1)) * 100}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          {region.id}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                  <div className="text-center">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
                    <p className="text-sm">Processing image...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Color Palette */}
      {Object.keys(colorPalette).length > 0 && (
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <h3 className="text-xl font-semibold">Color Palette</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-8">
            {Object.entries(colorPalette).map(([id, color]) => (
              <div key={id} className="text-center">
                <div
                  className="mx-auto mb-2 h-12 w-12 rounded-lg border-2 border-gray-400 shadow-sm dark:border-gray-500"
                  style={{ backgroundColor: color }}
                />
                <div className="text-sm font-medium">{id}</div>
                <div className="text-xs text-gray-500">{color}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
