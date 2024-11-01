import type { RequestHandler } from "@builder.io/qwik-city";
import { routes } from "@qwik-city-plan";
import { createSitemap } from "./create-sitemap";
import { getLogs } from "../dev-log/layout";
import { getBogs } from "../blog/layout";
import { calculateRelativeDate } from "~/components/utils";
import { getProjectSlugs } from "../projects/[slug]";

const exclusions = [
  "404.html",
  "sitemap.xml",
  /^blog\/.+$/,
  /^dev-log\/.+$/,
  /^projects\/.+$/,
  /^tags\/.+$/,
];
export const onGet: RequestHandler = (ev) => {
  const siteRoutes = routes
    .map(([route]) => route as string)
    .filter((route) => route !== "/")
    .filter((route) => {
      // Check if route is excluded
      return !exclusions.some((exclusion) =>
        typeof exclusion === "string"
          ? exclusion === route
          : exclusion.test(route),
      );
    });

  const posts = postsSitemap();
  const projects = projectsSitemap();

  const sitemap = createSitemap([
    { loc: "/", priority: 1 }, // Manually include the root route
    ...siteRoutes.map((route) => ({
      loc: route,
      priority: 0.9, // Default priority, adjust as needed
    })),
    ...posts,
    ...projects,
  ]);

  const response = new Response(sitemap, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });

  ev.send(response);
};

const postsSitemap = () => {
  const logs = getLogs()
    .filter(
      (l) => l.published === true && calculateRelativeDate(l.releaseDate) >= 0,
    )
    .map((l) => {
      return { loc: `${l.url}/`, priority: 0.9 };
    });
  const blogs = getBogs()
    .filter(
      (b) => b.published === true && calculateRelativeDate(b.releaseDate) >= 0,
    )
    .map((b) => {
      return { loc: `/blog/${b.slug}/`, priority: 0.9 };
    });

  return [...logs, ...blogs];
};

const projectsSitemap = () => {
  const data = getProjectSlugs();
  return data.map((p) => {
    return { loc: `/projects/${p}/`, priority: 0.5 };
  });
};
