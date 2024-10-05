import { component$, Slot } from "@builder.io/qwik";
import {
  type RequestHandler,
  routeLoader$,
  useLocation,
} from "@builder.io/qwik-city";
import Fourofour from "../404";
import { calculateRelativeDate } from "~/components/utils";

export type LogType = {
  title: string;
  description: string;
  tags: string[];
  published: boolean;
  url: string;
  releaseDate: string;
};

export function getLogs() {
  const modules = import.meta.glob("./log/**/*.mdx", { eager: true });

  const logs: LogType[] = [];
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

export const useLogLoader = routeLoader$(async () => {
  return getLogs();
});

export default component$(() => {
  const data = useLogLoader();
  const location = useLocation();

  const path = location.url.pathname;
  const post = data.value.find((p) => path.includes(p.url));
  if (
    post &&
    (post.published === false || calculateRelativeDate(post.releaseDate) < 0) &&
    import.meta.env.DEV === false
  ) {
    return <Fourofour />;
  }
  return <Slot />;
});

const revalidate = 60 * 60 * 12;
export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: revalidate,
    maxAge: revalidate,
    sMaxAge: revalidate,
  });
  cacheControl(
    {
      staleWhileRevalidate: revalidate,
      maxAge: revalidate,
      sMaxAge: revalidate,
    },
    "CDN-Cache-Control",
  );
};
