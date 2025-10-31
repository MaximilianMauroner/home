import { visit } from "unist-util-visit";

export function rehypeHeadings() {
    return function (tree, { data }) {
        const headings = [];

        visit(tree, "element", (node) => {
            if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
                const depth = parseInt(node.tagName.charAt(1));
                const text = extractText(node);
                const slug = generateSlug(text);

                headings.push({
                    depth,
                    slug,
                    text,
                });

                // Add id to the heading element for anchor links
                if (!node.properties.id) {
                    node.properties.id = slug;
                }
            }
        });

        // Store headings in the frontmatter
        if (!data.astro) {
            data.astro = {};
        }
        if (!data.astro.frontmatter) {
            data.astro.frontmatter = {};
        }
        data.astro.frontmatter.headings = headings;
    };
}

function extractText(node) {
    let text = "";
    if (node.children) {
        for (const child of node.children) {
            if (child.type === "text") {
                text += child.value;
            } else if (child.children) {
                text += extractText(child);
            }
        }
    }
    return text.trim();
}

function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "") // Remove special characters
        .replace(/\s+/g, "-") // Replace spaces with hyphens
        .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
        .trim();
}

