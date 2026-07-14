const blockedResponseBody = JSON.stringify({ error: "Not Found" });

export function blockProductionAdminApi(): Response | null {
  if (!import.meta.env.PROD) return null;

  return new Response(blockedResponseBody, {
    status: 404,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}
