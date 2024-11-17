// 1. Import utilities from `astro:content`
import { blogType, logType } from '@/utils/types';
import { z, defineCollection } from 'astro:content';

// 2. Define your collection(s)
const blogCollection = defineCollection({
    type: 'content',
    schema: blogType
});

const logCollection = defineCollection({
    type: 'content',
    schema: logType
});
// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
    'blog': blogCollection,
    'log': logCollection,
};