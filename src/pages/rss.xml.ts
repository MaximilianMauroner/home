import { getBlogs, getLogs } from '@/utils/helpers';
import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site }) => {
    const blog = await getBlogs();
    const logs = await getLogs();


    if (!site) {
        throw new Error('No site data found');
    }
    const posts = blog.map((post) => ({
        title: post.data.title,
        pubDate: post.data.releaseDate,
        description: post.data.description,
        link: `/blog/${post.id}/`,
    }))
    logs.forEach((post) => {
        posts.push({
            title: post.data.title,
            pubDate: post.data.releaseDate,
            description: post.data.description,
            link: `/dev-log/${post.id}/`,
        });
    });
    return rss({
        title: "Maximilians Blog/Log feed",
        description: "This contains all the blog and log posts from my page",
        site: site,
        items: posts,
    });
};
