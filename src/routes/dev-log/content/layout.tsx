import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return (
    <div class="prose mx-auto py-4">
      <Slot />
    </div>
  );
});
