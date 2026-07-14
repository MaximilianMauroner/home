import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

// OG cards are prerendered at build time, so reading from the project root
// (cwd) is reliable; the source font files are not bundled into dist/.
const fontDir = path.join(process.cwd(), "src/assets/fonts");
const fontRegular = fs.readFileSync(
  path.join(fontDir, "JetBrainsMono-Regular.ttf"),
);
const fontBold = fs.readFileSync(path.join(fontDir, "JetBrainsMono-Bold.ttf"));

export type OgCollection =
  | "blog"
  | "dev-log"
  | "home"
  | "snacks"
  | "tags"
  | "tools";

// Per-collection gradient schemes, mirroring the site's accent palette.
const SCHEMES: Record<
  OgCollection,
  { from: string; to: string; accent: string; label: string }
> = {
  blog: {
    from: "#312e81",
    to: "#6d28d9",
    accent: "#a5b4fc",
    label: "blog",
  },
  "dev-log": {
    from: "#0c4a6e",
    to: "#1e3a8a",
    accent: "#7dd3fc",
    label: "dev-log",
  },
  snacks: {
    from: "#4a044e",
    to: "#831843",
    accent: "#f0abfc",
    label: "snacks",
  },
  home: {
    from: "#172554",
    to: "#0f766e",
    accent: "#99f6e4",
    label: "home",
  },
  tags: {
    from: "#3f3f46",
    to: "#0f766e",
    accent: "#99f6e4",
    label: "tags",
  },
  tools: {
    from: "#1e293b",
    to: "#0369a1",
    accent: "#7dd3fc",
    label: "tools",
  },
};

// Minimal hyperscript so we can build the satori VDOM from a .ts file.
type El = { type: string; props: Record<string, unknown> };
const h = (
  type: string,
  props: Record<string, unknown>,
  children?: unknown,
): El => ({
  type,
  props: { ...props, children },
});

interface OgOptions {
  title: string;
  description?: string;
  collection: OgCollection;
  date?: Date;
}

export async function renderOgImage({
  title,
  description,
  collection,
  date,
}: OgOptions): Promise<Buffer> {
  const scheme = SCHEMES[collection];
  const dateLabel = date
    ? new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    : "";

  const tree = h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "1200px",
        height: "630px",
        padding: "64px",
        backgroundColor: scheme.from,
        backgroundImage: `linear-gradient(135deg, ${scheme.from}, ${scheme.to})`,
        fontFamily: "JetBrains Mono",
        color: "#ffffff",
        position: "relative",
      },
    },
    [
      // terminal prompt header
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            fontSize: "28px",
            color: scheme.accent,
          },
        },
        [
          h("span", { style: { color: "#c4b5fd" } }, "$ "),
          h("span", {}, `cat ${scheme.label}/`),
        ],
      ),
      // title
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "auto",
            fontSize: title.length > 48 ? "56px" : "72px",
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          },
        },
        title,
      ),
      // description
      description
        ? h(
            "div",
            {
              style: {
                display: "flex",
                marginTop: "24px",
                fontSize: "30px",
                color: "rgba(255,255,255,0.78)",
                lineHeight: 1.35,
              },
            },
            description.length > 140
              ? description.slice(0, 137) + "..."
              : description,
          )
        : h("div", {}, ""),
      // footer
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "48px",
            paddingTop: "28px",
            borderTop: "2px solid rgba(255,255,255,0.18)",
            fontSize: "26px",
          },
        },
        [
          h("span", { style: { fontWeight: 700 } }, "maximilian mauroner"),
          h("span", { style: { color: scheme.accent } }, dateLabel),
        ],
      ),
    ],
  );

  const svg = await satori(tree as unknown as React.ReactNode, {
    width: 1200,
    height: 630,
    fonts: [
      { name: "JetBrains Mono", data: fontRegular, weight: 400, style: "normal" },
      { name: "JetBrains Mono", data: fontBold, weight: 700, style: "normal" },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  return resvg.render().asPng();
}
