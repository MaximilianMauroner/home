export const INACTIVE_TOOL_SLUGS = new Set(["malen-nach-zahlen"]);

export function isToolActive(slug) {
  return !INACTIVE_TOOL_SLUGS.has(slug);
}

export function isInactiveToolUrl(url) {
  const pathname = new URL(url).pathname;

  for (const slug of INACTIVE_TOOL_SLUGS) {
    if (pathname === `/tools/${slug}/` || pathname === `/tools/${slug}`) {
      return true;
    }
  }

  return false;
}
