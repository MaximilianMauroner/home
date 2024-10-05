import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import Fourofour from "../404";
import { FontmatterTagsList } from "~/components/tags-list";

export type BlogType = {
  title: string;
  description: string;
  releaseDate: string;
  published: boolean;
  image: string;
  slug: string;
  tags: string[];
};

export function getBogs() {
  const modules = import.meta.glob("./**/*.mdx", { eager: true });

  const logs: BlogType[] = [];
  for (const path in modules) {
    // @ts-ignore
    const fM = modules[path].frontmatter;
    const url = path.replace("./", "").replace("/index.mdx", "");
    logs.push({
      title: fM?.title ?? "",
      description: fM?.description ?? "",
      releaseDate: fM?.releaseDate ?? new Date().toISOString(),
      published: fM?.published ?? false,
      slug: url,
      tags: fM?.tags ?? [],
      image: fM?.image ?? "",
    });
  }
  return logs;
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
        <Slot />
        <FontmatterTagsList />
      </article>
    );
  }
  return <Slot />;
});
