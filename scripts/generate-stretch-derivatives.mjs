/**
 * Rebuilds the responsive AVIF/WebP derivatives that StretchImage requests.
 *
 * Every canonical illustration in public/stretches/*.png gets one AVIF and one
 * WebP per width in RESPONSIVE_STRETCH_WIDTHS. Existing derivatives are skipped
 * unless they are older than their source PNG, so a normal run only encodes the
 * artwork you just added.
 *
 * Usage: bun run stretches:derivatives [--force]
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";

const SOURCE_DIR = "public/stretches";
const OUTPUT_DIR = join(SOURCE_DIR, "generated");
const WIDTHS = [320, 640, 960];
const ENCODERS = {
  avif: (image) => image.avif({ quality: 55, effort: 6 }),
  webp: (image) => image.webp({ quality: 78, effort: 6 }),
};

const force = process.argv.includes("--force");

async function modifiedAt(path) {
  try {
    return (await stat(path)).mtimeMs;
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const sources = (await readdir(SOURCE_DIR)).filter((name) =>
    name.endsWith(".png"),
  );
  let written = 0;

  for (const source of sources) {
    const sourcePath = join(SOURCE_DIR, source);
    const sourceModifiedAt = await modifiedAt(sourcePath);
    const name = basename(source, ".png");

    for (const width of WIDTHS) {
      for (const [format, encode] of Object.entries(ENCODERS)) {
        const outputPath = join(OUTPUT_DIR, `${name}-${width}w.${format}`);
        const outputModifiedAt = await modifiedAt(outputPath);
        if (
          !force &&
          outputModifiedAt !== null &&
          outputModifiedAt >= sourceModifiedAt
        ) {
          continue;
        }

        const buffer = await encode(
          sharp(sourcePath).resize({ width, withoutEnlargement: true }),
        ).toBuffer();
        await writeFile(outputPath, buffer);
        written += 1;
        console.log(`${outputPath} (${buffer.byteLength} bytes)`);
      }
    }
  }

  console.log(
    written === 0
      ? "All stretch derivatives are up to date."
      : `Wrote ${written} derivative${written === 1 ? "" : "s"}.`,
  );
}

await main();
