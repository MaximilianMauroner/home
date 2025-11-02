import { getCollection, type CollectionEntry } from "astro:content";

const filterFunction = (post: CollectionEntry<"blog"> | CollectionEntry<"log"> | CollectionEntry<"snacks">) => import.meta.env.DEV || (post.data.published && post.data.releaseDate < new Date());


export const getBlogs = async () => {
    const blog = await getCollection('blog');
    const filteredBlog = blog.filter(filterFunction).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });
    return filteredBlog;
}

export type BlogType = CollectionEntry<"blog">;

export const getLogs = async (): Promise<CollectionEntry<"log">[]> => {
    const log = await getCollection('log');
    const filteredLog = log.filter(filterFunction).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });
    return filteredLog;
}

export type LogType = CollectionEntry<"log">;

export const getSnacks = async (): Promise<CollectionEntry<"snacks">[]> => {
    const snacks = await getCollection('snacks');
    const filteredSnacks = snacks.filter(filterFunction).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });
    return filteredSnacks;
}

export type SnackType = CollectionEntry<"snacks">;

export const getTags = (
    blogs: CollectionEntry<"blog">[],
    logs: CollectionEntry<"log">[],
    snacks: CollectionEntry<"snacks">[],
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

    for (const fM of snacks) {
        fM.data.tags.forEach((tag: string) => {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
    }

    return tagCounts;
}
