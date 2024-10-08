import { component$ } from "@builder.io/qwik";
import Astronaut from "~/media/astronaut.avif?jsx";
export default component$(() => {
  return (
    <div class="my-auto flex flex-col items-center justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-md text-center">
        <Astronaut
          class="mx-auto"
          style="aspect-ratio: 200 / 200; object-fit: cover;"
          alt="404 Error showing an astronaut"
          loading="eager"
        />
        <h1 class="mt-8 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Oops, page not found!
        </h1>
        <p class="mt-4 text-muted-foreground">
          The page you're looking for doesn't exist or has not been published
          yet.
        </p>
        <div class="mt-6">
          <a
            class="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            href="/"
            rel="ugc"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  );
});
