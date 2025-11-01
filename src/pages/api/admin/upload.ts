import type { APIRoute } from "astro";
import { writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];
    const contentType = formData.get("contentType") as string;

    if (!files || files.length === 0) {
      return new Response(
        JSON.stringify({ error: "No files provided" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const baseDir = process.cwd();
    const uploadedUrls: string[] = [];

    // Determine assets directory based on content type
    let assetsDir: string;
    if (contentType === "log") {
      // For logs, files are stored directly in the log directory
      assetsDir = join(baseDir, "src", "assets", "log");
    } else if (contentType === "blog") {
      // For blog, we'll create a folder based on timestamp or next available number
      const blogBaseDir = join(baseDir, "src", "assets", "blog");
      let blogDirs: string[] = [];
      try {
        blogDirs = await readdir(blogBaseDir);
      } catch {
        // Directory doesn't exist yet, will be created
      }
      // Find next number (simple approach - in production you might want something more sophisticated)
      const nextNum = blogDirs.length > 0 
        ? Math.max(...blogDirs.map((d) => parseInt(d) || 0)) + 1
        : 0;
      assetsDir = join(blogBaseDir, nextNum.toString().padStart(3, "0"));
    } else {
      // For snacks, use a simple structure
      assetsDir = join(baseDir, "src", "assets", "snacks");
    }

    // Ensure the directory exists
    await mkdir(assetsDir, { recursive: true });

    // Process each file
    for (const file of files) {
      // Validate it's an image
      if (!file.type.startsWith("image/")) {
        continue; // Skip non-image files
      }

      // Generate a safe filename
      const timestamp = Date.now();
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const ext = originalName.split(".").pop() || "jpg";
      const fileName = `${timestamp}-${originalName}`;

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Write file to disk
      const filePath = join(assetsDir, fileName);
      await writeFile(filePath, buffer);

      // Generate the URL path that should be used in the content
      // This matches the structure used in the project
      let urlPath: string;
      if (contentType === "log") {
        urlPath = `/src/assets/log/${fileName}`;
      } else if (contentType === "blog") {
        const blogNum = assetsDir.split(/[\\/]/).pop() || "000";
        urlPath = `/src/assets/blog/${blogNum}/${fileName}`;
      } else {
        urlPath = `/src/assets/snacks/${fileName}`;
      }

      uploadedUrls.push(urlPath);
    }

    if (uploadedUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid image files uploaded" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, urls: uploadedUrls }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error uploading files:", error);
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

