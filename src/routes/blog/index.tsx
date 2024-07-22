import { component$, useSignal } from "@builder.io/qwik";
import {
  routeLoader$,
  server$,
  type DocumentHead,
} from "@builder.io/qwik-city";

type BlogPostType = {
  title: string;
  image: string;
  date: string;
  description: string;
  slug: string;
  published: boolean;
  tags: string[];
};

import * as fs from "node:fs";

export const getBlogData = routeLoader$(() => {
  const files: string[] = [];
  fs.readdirSync(".").forEach((file) => {
    console.log(file);
    files.push(file);
  });
  return files;
});

const blogsPosts: BlogPostType[] = [
  {
    title: "Hello World",
    image: "https://source.unsplash.com/random/800x600",
    date: "2023-09-22",
    description:
      "Since this is my first blog post, so I thought I'd start with a classic",
    slug: "hello-world",
    published: false,
    tags: ["hello-world", "blog"],
  },
];

export const head: DocumentHead = {
  title: "Blog",
  meta: [
    {
      name: "description",
      content:
        "Trying to get my blog started so future historians can have my genius thoughts preserved for eternity /s",
    },
  ],
};

const Blog = component$(() => {
  const data = getBlogData();
  console.log(data.value);

  return (
    <>
      <div>Data:{data.value.join(",")}</div>
      <section>
        <div class="mx-auto max-w-screen-xl px-4 py-8 lg:px-6 lg:py-16">
          <div class="mx-auto mb-8 max-w-screen-sm text-center lg:mb-16">
            <h2 class="mb-4 text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl ">
              My Blog
            </h2>
            <p class="l font-light text-gray-500 sm:text-xl">
              Trying to get my blog started so future historians can have my
              genius thoughts preserved for eternity /s
            </p>
          </div>
          <div class="grid gap-8 lg:grid-cols-2">
            {blogsPosts
              .filter(
                (e) => e.published || process.env.NODE_ENV === "development",
              )
              .map((post) => (
                <BlogPreview key={post.slug} post={post} />
              ))}
          </div>
        </div>
      </section>
    </>
  );
});
export default Blog;

const BlogPreview = component$<{ post: BlogPostType }>(
  ({ post }: { post: BlogPostType }) => {
    const calculateReleaseDate = () => {
      const date1 = new Date(post.date);
      const date2 = new Date();
      const diffTime = date2.getTime() - date1.getTime();
      const days = diffTime / (1000 * 3600 * 24);
      return Math.floor(days);
    };
    return (
      <article class="rounded-lg border border-gray-200 bg-card p-6 shadow-md ">
        <div class="mb-5 flex items-center justify-between">
          <span class="inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium text-primary">
            <svg
              class="mr-1 h-3 w-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path>
            </svg>

            <span>
              {post.tags.map((tag, index) => (
                <a
                  key={tag}
                  class="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium text-primary underline-offset-4 ring-offset-background transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                  href={"/blog/tags/" + tag}
                >
                  {tag + (index < post.tags.length - 1 ? ", " : "")}
                </a>
              ))}
            </span>
          </span>
          <span class="text-sm text-muted-foreground">
            {calculateReleaseDate()} days ago
          </span>
        </div>
        <h2 class="mb-2 text-2xl font-bold tracking-tight text-primary">
          <a href={"/blog/" + post.slug}>{post.title}</a>
        </h2>
        <p class="mb-5 font-light text-muted-foreground">{post.description}</p>
        <div class="flex items-center justify-between text-sm font-medium text-primary underline-offset-4 ring-offset-background transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
          <a
            href={"/blog/" + post.slug}
            class="inline-flex items-center font-medium text-primary hover:underline"
          >
            Read more
            <svg
              class="ml-2 h-4 w-4"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clip-rule="evenodd"
              ></path>
            </svg>
          </a>
        </div>
      </article>
    );
  },
);
