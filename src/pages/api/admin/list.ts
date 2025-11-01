import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const contentType = url.searchParams.get("type") || "all";

    const result: {
      blogs?: Array<{ id: string; title: string; published: boolean }>;
      logs?: Array<{ id: string; title: string; published: boolean }>;
      snacks?: Array<{ id: string; title: string; published: boolean }>;
    } = {};

    if (contentType === "all" || contentType === "blog") {
      // Use getCollection directly to bypass filtering - show all posts in admin
      const blogsCollection = await getCollection("blog");
      result.blogs = blogsCollection
        .sort((a: CollectionEntry<"blog">, b: CollectionEntry<"blog">) => {
          return (
            new Date(b.data.releaseDate).getTime() -
            new Date(a.data.releaseDate).getTime()
          );
        })
        .map((blog: CollectionEntry<"blog">) => ({
          id: blog.id,
          title: blog.data.title,
          published: blog.data.published,
        }));
    }

    if (contentType === "all" || contentType === "log") {
      // Use getCollection directly to bypass filtering - show all posts in admin
      const logsCollection = await getCollection("log");
      result.logs = logsCollection
        .sort((a: CollectionEntry<"log">, b: CollectionEntry<"log">) => {
          return (
            new Date(b.data.releaseDate).getTime() -
            new Date(a.data.releaseDate).getTime()
          );
        })
        .map((log: CollectionEntry<"log">) => ({
          id: log.id,
          title: log.data.title,
          published: log.data.published,
        }));
    }

    if (contentType === "all" || contentType === "snack") {
      // Use getCollection directly to bypass filtering - show all posts in admin
      // This ensures all snacks are shown in admin, regardless of published/date status
      const snacksCollection = await getCollection("snacks");
      result.snacks = snacksCollection
        .sort((a: CollectionEntry<"snacks">, b: CollectionEntry<"snacks">) => {
          return (
            new Date(b.data.releaseDate).getTime() -
            new Date(a.data.releaseDate).getTime()
          );
        })
        .map((snack: CollectionEntry<"snacks">) => ({
          id: snack.id,
          title: snack.data.title,
          published: snack.data.published,
        }));
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing content:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
