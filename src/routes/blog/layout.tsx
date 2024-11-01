import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import Fourofour from "../404";
import { FontmatterTagsList } from "~/components/tags-list";
import TableOfContents from "~/components/table-of-contents";

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

export function getBogs() {
  const modules = import.meta.glob("./**/*.mdx", { eager: true });

  const blogs: BlogType[] = [];
  for (const path in modules) {
    // @ts-ignore
    const fM = modules[path].frontmatter;
    // @ts-ignore
    const headings = modules[path].headings;
    const url = path.replace("./", "").replace("/index.mdx", "");
    blogs.push({
      title: fM?.title ?? "",
      description: fM?.description ?? "",
      releaseDate: fM?.releaseDate ?? new Date().toISOString(),
      published: fM?.published ?? false,
      slug: url,
      tags: fM?.tags ?? [],
      image: fM?.image ?? "",
      headings: headings.map(({ text }: { text: string }) => text),
    });
  }
  return blogs;
}

export const useBlogLoader = routeLoader$(async () => {
  return getBogs();
});

export default component$(() => {
  const data = useBlogLoader();
  const location = useLocation();

  const path = location.url.pathname;
  const post = data.value.find((p) => path.includes(p.slug));
  if (post && post.published === false) {
    return <Fourofour />;
  }
  if (post) {
    return (
      <article class="prose mx-auto px-2 py-4 sm:px-0">
        <TableOfContents headingsArr={post.headings} />
        <Slot />
        <FontmatterTagsList />
      </article>
    );
  }
  return <Slot />;
});
