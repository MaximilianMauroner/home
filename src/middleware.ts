import { defineMiddleware } from "astro:middleware";

// `context` and `next` are automatically typed
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (pathname.startsWith("/ingest/static/")) {
    const newUrl = pathname.replace(
      "/ingest/static/",
      "https://eu-assets.i.posthog.com/static/",
    );
    try {
      const response = await fetch(newUrl);
      if (response.ok) {
        return Response.redirect(newUrl, 308);
      }
      // If resource doesn't exist, continue to next handler
    } catch (error) {
      // If fetch fails, continue to next handler
    }
  }

  // Handle API rewrite
  if (pathname.startsWith("/ingest/")) {
    const newUrl = pathname.replace("/ingest/", "https://eu.i.posthog.com/");
    return Response.redirect(newUrl, 308);
  }

  return next();
});