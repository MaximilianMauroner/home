import { component$, Slot } from "@builder.io/qwik";
import { FontmatterTagsList } from "~/components/tags-list";

export default component$(() => {
  return (
    <article class="prose mx-auto px-2 py-4 sm:px-0">
      <Slot />
      <FontmatterTagsList />
    </article>
  );
});
