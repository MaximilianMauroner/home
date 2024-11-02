import { component$, Slot } from "@builder.io/qwik";
import Footer from "~/components/footer";
import type { RequestHandler } from "@builder.io/qwik-city";
import Header from "../components/header";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  // Control caching for this request for best performance and to reduce hosting costs:
  // https://qwik.dev/docs/caching/
  cacheControl({
    // Always serve a cached response by default, up to a week stale
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    // Max once every 5 seconds, revalidate on the server to get a fresh version of this page
    maxAge: 5,
  });
};

export default component$(() => {
  return (
    <>
      <Header />
      <main class="flex-1">
        <Slot />
      </main>
      <span class="text-sm text-muted-foreground">
        This is page is cached from:&nbsp;
        {new Date().toLocaleString("en-GB", { timeZoneName: "shortOffset" })}
      </span>
      <Footer />
    </>
  );
});
