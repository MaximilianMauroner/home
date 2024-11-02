export interface SitemapEntry {
  loc: string;
  priority: number;
}

export function createSitemap(entries: SitemapEntry[]) {
  const baseUrl = "https://www.mauroner.net";
  const data = entries
    .map((entry) => {
      return `    <url>
        <loc>${baseUrl}${entry.loc.startsWith("/") ? "" : "/"}${entry.loc}</loc>
        <priority>${entry.priority}</priority>
    </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${data}
</urlset>`;
}
