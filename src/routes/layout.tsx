import { component$, Slot } from "@builder.io/qwik";
import Footer from "~/components/footer";
import type { RequestHandler } from "@builder.io/qwik-city";
import Header from "../components/header";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 5, // 60 * 60 * 24 * 365,
    maxAge: 5,
  });
  cacheControl(
    {
      maxAge: 5,
      staleWhileRevalidate: 5, // 60 * 60 * 24 * 365,
    },
    "CDN-Cache-Control",
  );
};

export default component$(() => {
  return (
    <>
      <Header />
      <main class="flex-1">
        <Slot />
      </main>
      <Footer />
    </>
  );
});
