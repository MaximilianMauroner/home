import type { APIRoute } from "astro";
import { unlink } from "fs/promises";
import { join } from "path";

export const prerender = false;

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const { type, id } = await request.json();

    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: "Missing type or id" }),
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

    const baseDir = process.cwd();
    const contentDir = join(baseDir, "src", "content", type === "snack" ? "snacks" : type);

    // Construct the full file path
    let filePath = "";
    if (type === "log") {
      // Log files: src/content/log/YYYY/MM.mdx
      filePath = join(contentDir, `${id}.mdx`);
    } else {
      // Blog and snack files: src/content/{type}/filename.mdx
      filePath = join(contentDir, `${id}.mdx`);
    }

    // Delete the file
    await unlink(filePath);

    return new Response(
      JSON.stringify({ success: true, message: "Post deleted successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error deleting content:", error);
    
    // If file doesn't exist, that's okay - it's already deleted
    if (error instanceof Error && (error as any).code === "ENOENT") {
      return new Response(
        JSON.stringify({ success: true, message: "Post already deleted" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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

