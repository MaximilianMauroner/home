import type { MDXInstance } from "astro";
import type { BlogType, LogType } from "./types";

export const calculateRelativeDate = (releaseDate: string) => {
    const date1 = new Date(releaseDate);
    const date2 = new Date();
    const diffTime = date2.getTime() - date1.getTime();
    const days = diffTime / (1000 * 3600 * 24);
    return Math.floor(days);
};

export const kebabCase = (str: string) =>
    str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();



export const blogsFromMDX = (blogPostsData: MDXInstance<Record<string, any>>[]) => {
    const blogs: BlogType[] = [];

    for (const fM of blogPostsData) {
        blogs.push({
            title: fM.frontmatter?.title ?? "",
            description: fM.frontmatter?.description ?? "",
            releaseDate: fM.frontmatter?.releaseDate ?? new Date().toISOString(),
            published: fM.frontmatter?.published ?? false,
            slug: fM.url ?? "",
            tags: fM.frontmatter?.tags ?? [],
            image: fM.frontmatter?.image ?? "",
            headings: fM.getHeadings().map((heading) => heading.slug)
        });
    }
    return blogs;
}

export const logsFromMDX = (logPostsData: MDXInstance<Record<string, any>>[]) => {
    const logs: LogType[] = [];

    for (const fM of logPostsData) {
        logs.push({
            title: fM.frontmatter?.title ?? "",
            description: fM.frontmatter?.description ?? "",
            releaseDate: fM.frontmatter?.releaseDate ?? new Date().toISOString(),
            published: fM.frontmatter?.published ?? false,
            url: fM.url ?? "",
            tags: fM.frontmatter?.tags ?? [],
            headings: fM.getHeadings().map((heading) => heading.slug)
        });
    }
    return logs;
}