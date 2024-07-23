import { type RequestHandler } from "@builder.io/qwik-city";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 5,
    maxAge: 5,
    sMaxAge: 5,
  });
  cacheControl(
    {
      staleWhileRevalidate: 60 * 5,
      maxAge: 5,
      sMaxAge: 5,
    },
    "CDN-Cache-Control",
  );
};
