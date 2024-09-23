import { component$ } from "@builder.io/qwik";
import { getBogs } from "../blog/layout";
import { getLogs } from "../dev-log/layout";
import { routeLoader$ } from "@builder.io/qwik-city";

export const useTagLoader = routeLoader$(async () => {
  const blogs = getBogs();
  const logs = getLogs();

  const tags = new Map<string, number>();

  blogs.forEach((b) => {
    b.tags.forEach((t) => {
      tags.set(t, (tags.get(t) ?? 0) + 1);
    });
  });

  logs.forEach((l) => {
    l.tags.forEach((t) => {
      tags.set(t, (tags.get(t) ?? 0) + 1);
    });
  });
  return Array.from(tags.keys());
});

export default component$(() => {
  const tags = useTagLoader();

  console.log(tags.value);
  return <section></section>;
});
