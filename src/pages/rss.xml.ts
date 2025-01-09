import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
    let blog = await getCollection('blog');
    blog = blog.filter((post) => post.data.published).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    });


    let log = await getCollection('log');
    log = log.filter((post) => post.data.published).sort((a, b) => {
        return new Date(b.data.releaseDate).getTime() - new Date(a.data.releaseDate).getTime();
    })

    if (!site) {
        throw new Error('No site data found');
    }
    const posts = blog.map((post) => ({
        title: post.data.title,
        pubDate: post.data.releaseDate,
        description: post.data.description,
        link: `/blog/${post.id}/`,
    }))
    log.forEach((post) => {
        posts.push({
            title: post.data.title,
            pubDate: post.data.releaseDate,
            description: post.data.description,
            link: `/dev-log/${post.id}/`,
        });
    });
    return rss({
        title: 'Maximilians Blog/Log feed',
        description: 'This contains all the blog and log posts from my page',
        site: site,
        items: posts,
    });
}