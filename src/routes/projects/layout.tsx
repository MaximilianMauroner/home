import { type RequestHandler } from "@builder.io/qwik-city";

const revalidate = 60 * 5;
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
