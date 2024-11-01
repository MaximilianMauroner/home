import { component$, Slot } from "@builder.io/qwik";
import { type RequestHandler } from "@builder.io/qwik-city";

const revalidate = 60 * 60 * 12;
export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: revalidate,
    maxAge: revalidate,
    sMaxAge: revalidate,
  });
  cacheControl(
    {
      staleWhileRevalidate: revalidate,
      maxAge: revalidate,
      sMaxAge: revalidate,
    },
    "CDN-Cache-Control",
  );
};

export default component$(() => {
  return <Slot />;
});
