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
  const posts = blog.map((post) => ({
    title: post.data.title,
    pubDate: post.data.releaseDate,
    description: post.data.description,
    link: `/blog/${post.id}/`,
  }));
  logs.forEach((post) => {
    posts.push({
      title: post.data.title,
      pubDate: post.data.releaseDate,
      description: post.data.description,
      link: `/dev-log/${post.id}/`,
    });
  });
  snacks.forEach((post) => {
    posts.push({
      title: post.data.title,
      pubDate: post.data.releaseDate,
      description: post.data.description,
      link: `/snacks/${post.id}/`,
    });
  });
  return rss({
    title: "Maximilian Mauroner - Blog, Dev Log & Snacks",
    description:
      "Blog posts, development logs, and quick tips about programming, development, and technology",
    site: site,
    items: posts,
    customData: `<language>en-us</language><copyright>Copyright ${new Date().getFullYear()} Maximilian Mauroner</copyright>`,
  });
};
