import { component$ } from "@builder.io/qwik";
import { type DocumentHead } from "@builder.io/qwik-city";

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
          </div>
          <div class="grid gap-8 lg:grid-cols-2"></div>
        </div>
      </section>
    </>
  );
});
export default Blog;
