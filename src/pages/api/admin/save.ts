import type { APIRoute } from "astro";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { type, filePath, frontmatter, content } = await request.json();

    if (!type || !filePath || !frontmatter || content === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate content type
    const validTypes = ["blog", "log", "snack"];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid content type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Determine the base content directory
    const baseDir = process.cwd();
    const contentDir = join(baseDir, "src", "content", type === "snack" ? "snacks" : type);

    // Ensure the directory exists
    if (type === "log") {
      // For logs, we need to create the year directory if it doesn't exist
      const year = filePath.split("/")[0];
      const yearDir = join(contentDir, year);
      await mkdir(yearDir, { recursive: true });
    } else {
      // For blog and snack, just ensure the base directory exists
      await mkdir(contentDir, { recursive: true });
    }

    // Construct the full file path
    const fullPath = join(contentDir, filePath);

    // Format frontmatter
    const frontmatterString = Object.entries(frontmatter)
      .filter(([_, value]) => {
        // Filter out empty strings and undefined values
        if (value === undefined || value === null) return false;
        if (typeof value === "string" && value.trim() === "") return false;
        return true;
      })
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}:\n${value.map((item) => `  - ${item}`).join("\n")}`;
        }
        if (typeof value === "string" && value.includes("\n")) {
          return `${key}: |\n${value.split("\n").map((line) => `  ${line}`).join("\n")}`;
        }
        if (typeof value === "boolean") {
          return `${key}: ${value}`;
        }
        if (value instanceof Date || (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}$/))) {
          return `${key}: ${value}`;
        }
        return `${key}: "${value}"`;
      })
      .join("\n");

    // Combine frontmatter and content
    const mdxContent = `---\n${frontmatterString}\n---\n\n${content}`;

    // Write the file
    await writeFile(fullPath, mdxContent, "utf-8");

    return new Response(
      JSON.stringify({ success: true, path: fullPath }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error saving content:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

