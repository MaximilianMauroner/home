import {
  routeLoader$,
  StaticGenerateHandler,
  useLocation,
} from "@builder.io/qwik-city";
import { component$ } from "@builder.io/qwik";
import { BlogPreview, blogsPosts } from "../..";

export const useGetBlogByTags = routeLoader$(({ params }) => {
  return blogsPosts.filter((project) =>
    project.tags.find((t) => t === params.tag),
  );
});

export default component$(() => {
  const loc = useLocation();
  const blogs = useGetBlogByTags().value;
  const tags = getAllTags();
  return (
    <section>
      <div class="mx-auto max-w-screen-xl px-4 py-8 lg:px-6 lg:py-16">
        <div class="mx-auto mb-8 max-w-screen-sm text-center lg:mb-16">
          Blogs with tag:
          <h2 class="mb-4 text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl ">
            <b>{loc.params.tag}</b>
          </h2>
        </div>
        <div class="inline-flex w-full items-center justify-center gap-2 text-xs font-medium text-primary">
          <h3 class="text-lg">Tags:</h3>
          {tags.map((tag, index) => (
            <a
              key={tag}
              class="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md text-sm font-medium text-primary underline-offset-4 ring-offset-background transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
              href={"/blog/tags/" + tag}
            >
              {tag + (index < tags.length - 1 ? ", " : "")}
            </a>
          ))}
        </div>
        <div class="grid gap-8 lg:grid-cols-2">
          {blogs
            .filter(
              (e) => e.published || process.env.NODE_ENV === "development",
            )
            .map((post) => (
              <BlogPreview key={post.slug} post={post} />
            ))}
        </div>
      </div>
    </section>
  );
});

const getAllTags = () => {
  const tagsMap = new Map();
  blogsPosts.forEach((blog) => {
    blog.tags.forEach((tag) => {
      if (!tagsMap.has(tagsMap)) {
        tagsMap.set(tag, true);
      }
    });
  });
  return Array.from(tagsMap.keys());
};

export const onStaticGenerate: StaticGenerateHandler = () => {
  const ids = getAllTags();

  return {
    params: ids.map((slug) => {
      return { slug };
    }),
  };
};
