import { getCollection, type CollectionEntry } from "astro:content";

export const calculateRelativeDate = (releaseDate: Date) => {
    const date2 = new Date();
    const diffTime = date2.getTime() - releaseDate.getTime();
    const days = diffTime / (1000 * 3600 * 24);
    return Math.floor(days);
};

export const kebabCase = (str: string) =>
    str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[\s_]+/g, "-")
        .toLowerCase();

export const getTags = (
    blogs: CollectionEntry<"blog">[],
    logs: CollectionEntry<"log">[],
) => {
    const tagCounts = new Map<string, number>();

    for (const fM of blogs) {
        fM.data.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
    }

    for (const fM of logs) {
        fM.data.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
    }

    return tagCounts;
}


const filterFunction = (post: CollectionEntry<"blog"> | CollectionEntry<"log">) => import.meta.env.DEV || (post.data.published && post.data.releaseDate < new Date());


export const getBlogs = async () => {
    const blog = await getCollection('blog');
    const filteredBlog = blog.filter(filterFunction).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });
    return filteredBlog;
}

export const getLogs = async () => {
    const log = await getCollection('log');
    const filteredLog = log.filter(filterFunction).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });
    return filteredLog;
}
