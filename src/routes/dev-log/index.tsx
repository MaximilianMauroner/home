import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear"; // ES 2015
import { type LogType, useLogLoader } from "./layout";
import TagsList from "~/components/tags-list";
import { calculateRelativeDate } from "~/components/utils";

export const head: DocumentHead = {
  title: "dev log",
  meta: [
    {
      name: "description",
      content: "weekly summary of what i've been working on",
    },
  ],
};

const Blog = component$(() => {
  dayjs.extend(weekOfYear);
  const currentWeek = dayjs().week(); // 26
  const currentYear = dayjs().year(); // 2024

  const data = useLogLoader();
  return (
    <>
      <section>
        <div class="mx-auto max-w-screen-xl px-4 py-8 lg:px-6 lg:py-16">
          <div class="mx-auto mb-8 max-w-screen-sm text-center lg:mb-16">
            <h2 class="mb-4 text-3xl font-extrabold tracking-tight text-gray-900 lg:text-4xl">
              dev log
            </h2>
            <p class="l font-light text-gray-500 sm:text-xl">
              weekly summary of what i've been working on
            </p>
            <p>
              next log:&nbsp;
              <b>
                <a href={`/dev-log/log/${currentYear}/${currentWeek}`}>
                  {currentYear + "/" + currentWeek}
                </a>
              </b>
            </p>
          </div>
          <div class="grid gap-8 lg:grid-cols-2">
            {data.value
              .filter(
                (e) =>
                  (e.published === true &&
                    calculateRelativeDate(e.releaseDate) >= 0) ||
                  process.env.NODE_ENV === "development",
              )
              .map((post) => (
                <LogPreview key={post.url} post={post} />
              ))}
          </div>
        </div>
      </section>
    </>
  );
});

export const LogPreview = component$<{ post: LogType }>(
  ({ post }: { post: LogType }) => {
    const releaseDate = calculateRelativeDate(post.releaseDate);
    return (
      <article class="rounded-lg border border-gray-200 bg-card p-6 shadow-md">
        <div class="mb-5 flex items-center justify-between gap-1">
          <div class="inline-flex items-center overflow-auto rounded px-2.5 py-0.5 text-xs font-medium text-primary">
            <svg
              class="mr-1 h-3 w-3"
              fill="currentColor"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z"></path>
            </svg>
            <div class="flex w-full overflow-auto">
              <TagsList tags={post.tags} />
            </div>
          </div>
          <span class="hidden text-sm text-muted-foreground sm:block">
            {releaseDate < 0
              ? `releases in ${Math.abs(releaseDate)} days`
              : `released ${releaseDate} days ago`}
          </span>
        </div>
        <h2 class="mb-2 text-2xl font-bold tracking-tight text-primary underline-offset-4 hover:underline">
          <a href={post.url}>{post.title}</a>
        </h2>
        <p class="mb-5 font-light text-muted-foreground">{post.description}</p>
        <div class="flex items-center justify-between text-sm font-medium text-primary ring-offset-background">
          <a
            href={post.url}
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

export default Blog;
