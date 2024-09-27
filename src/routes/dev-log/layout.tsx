import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import Fourofour from "../404";

export type Log = {
  title: string;
  description: string;
  tags: string[];
  published: boolean;
  url: string;
  releaseDate: string;
};

export function getLogs() {
  const modules = import.meta.glob("./log/**/*.mdx", { eager: true });

  const logs: Log[] = [];
  for (const path in modules) {
    // @ts-ignore
    const fM = modules[path].frontmatter;
    const url = path.replace("./", "/dev-log/").replace("/index.mdx", "");
    logs.push({
      title: fM?.title ?? "",
      description: fM?.description ?? "",
      tags: fM?.tags ?? [],
      published: fM?.published ?? false,
      url,
      releaseDate: fM?.releaseDate ?? new Date().toISOString(),
    });
  }
  return logs;
}

export const calculateRelativeDate = (post: Log) => {
  const date1 = new Date(post.releaseDate);
  const date2 = new Date();
  const diffTime = date2.getTime() - date1.getTime();
  const days = diffTime / (1000 * 3600 * 24);
  return Math.floor(days);
};

export const useLogLoader = routeLoader$(async () => {
  return getLogs();
});

export default component$(() => {
  const data = useLogLoader();
  const location = useLocation();

  const path = location.url.pathname;
  const post = data.value.find((p) => path.includes(p.url));
  if (post && (post.published === false || calculateRelativeDate(post) < 0)) {
    return <Fourofour />;
  }
  return <Slot />;
});
