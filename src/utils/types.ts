export type BlogType = {
    title: string;
    description: string;
    releaseDate: string;
    published: boolean;
    image: string;
    slug: string;
    tags: string[];
    headings: string[];
};

export type LogType = {
    title: string;
    description: string;
    tags: string[];
    published: boolean;
    url: string;
    releaseDate: string;
    headings: string[];
};
export type HeadingType = {
    depth: number;
    slug: string;
    text: string;
};