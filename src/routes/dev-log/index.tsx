import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";
import dayjs from "dayjs";
import weekOfYear from "dayjs/plugin/weekOfYear"; // ES 2015
import { start } from "repl";

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
  let currentWeek = dayjs().week(); // 26
  let currentYear = dayjs().year(); // 2024
  const startWeek = "2024-09-18";

  const logs = dayjs().diff(dayjs(startWeek), "week", false);
  console.log(logs);

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
              next log{" "}
              <a href={`/dev-log/content/${currentYear}/${currentWeek}`}>
                {currentYear + "/" + currentWeek}
              </a>
            </p>
            {new Array(logs).fill(0).map((_, i) => {
              currentWeek--;
              if (currentWeek < 1) {
                currentYear--;
                currentWeek = 52;
              }
              return (
                <div key={i}>
                  <a href={`/dev-log/content/${currentYear}/${currentWeek}`}>
                    {currentYear + "/" + currentWeek}
                  </a>
                </div>
              );
            })}
          </div>
          <div class="grid gap-8 lg:grid-cols-2"></div>
        </div>
      </section>
    </>
  );
});
export default Blog;
