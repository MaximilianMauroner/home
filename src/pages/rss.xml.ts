import { getBlogs, getLogs, getSnacks } from "@/utils/server/content";
import rss from "@astrojs/rss";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ site }) => {
  const blog = await getBlogs();
  const logs = await getLogs();
  const snacks = await getSnacks();

  if (!site) {
    throw new Error("No site data found");
  }
  const posts = [
    ...blog.map((post) => ({
      title: post.data.title,
      pubDate: post.data.releaseDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      customData: `<guid isPermaLink="true">${new URL(`/blog/${post.id}/`, site).href}</guid>`,
      categories: post.data.tags,
    })),
    ...logs.map((post) => ({
      title: post.data.title,
      pubDate: post.data.releaseDate,
      description: post.data.description,
      link: `/dev-log/${post.id}/`,
      customData: `<guid isPermaLink="true">${new URL(`/dev-log/${post.id}/`, site).href}</guid>`,
      categories: post.data.tags,
    })),
    ...snacks.map((post) => ({
      title: post.data.title,
      pubDate: post.data.releaseDate,
      description: post.data.description,
      link: `/snacks/${post.id}/`,
      customData: `<guid isPermaLink="true">${new URL(`/snacks/${post.id}/`, site).href}</guid>`,
      categories: post.data.tags,
    })),
  ].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  );
  return rss({
    title: "Maximilian Mauroner - Blog, Dev Log & Snacks",
    description:
      "Blog posts, development logs, and quick tips about programming, development, and technology",
    site: site,
    items: posts,
    customData: `<language>en-us</language><copyright>Copyright ${new Date().getFullYear()} Maximilian Mauroner</copyright>`,
  });
};
