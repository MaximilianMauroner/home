import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { readFile } from "fs/promises";
import { join } from "path";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const type = url.searchParams.get("type");
    const id = url.searchParams.get("id");

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: "Missing type or id parameter" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const validTypes = ["blog", "log", "snack"];
    if (!validTypes.includes(type)) {
      return new Response(
        JSON.stringify({ error: "Invalid content type" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the entry from Astro's content collection
    let collection;
    if (type === "snack") {
      collection = await getCollection("snacks");
    } else if (type === "blog") {
      collection = await getCollection("blog");
    } else {
      collection = await getCollection("log");
    }
    const entry = collection.find((e) => e.id === id);

    if (!entry) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Read the raw file to get the content
    const baseDir = process.cwd();
    let filePath = "";
    
    if (type === "log") {
      // Log files: src/content/log/YYYY/MM.mdx
      filePath = join(baseDir, "src", "content", "log", `${id}.mdx`);
    } else if (type === "blog") {
      // Blog files: src/content/blog/XXX-slug.mdx
      filePath = join(baseDir, "src", "content", "blog", `${id}.mdx`);
    } else {
      // Snack files: src/content/snacks/slug.mdx
      filePath = join(baseDir, "src", "content", "snacks", `${id}.mdx`);
    }

    const fileContent = await readFile(filePath, "utf-8");
    
    // Simple frontmatter parser (looks for --- delimiters)
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = fileContent.match(frontmatterRegex);
    const content = match ? match[2].trim() : fileContent.trim();

    // Extract the slug/year/month from the ID
    let slug = "";
    let year = "";
    let month = "";

    if (type === "log") {
      // ID format: "2025/17" (year/week)
      const parts = id.split("/");
      year = parts[0] || "";
      month = parts[1] || ""; // This is actually week number, keeping variable name for compatibility
    } else {
      // For blog and snack, extract slug
      slug = id;
      // Remove number prefix from blog and snack slugs if present
      if ((type === "blog" || type === "snack") && /^\d{3}-/.test(slug)) {
        slug = slug.replace(/^\d{3}-/, "");
      }
    }

    return new Response(
      JSON.stringify({
        id: entry.id,
        type,
        slug,
        year,
        month,
        frontmatter: {
          title: entry.data.title,
          description: entry.data.description,
          tags: entry.data.tags,
          image: entry.data.image || "",
          published: entry.data.published,
          releaseDate: entry.data.releaseDate.toISOString().split("T")[0],
        },
        content: content.trim(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error getting content:", error);
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

