import { component$, Slot } from "@builder.io/qwik";
import Footer from "~/components/footer";
import type { RequestHandler } from "@builder.io/qwik-city";
import Header from "../components/header";

export default component$(() => {
  return (
    <body class={"min-h-dvh flex flex-col"}>
      <Header />
      <main class="flex-1">
        <Slot />
      </main>
      <Footer />
    </body>
  );
});

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
