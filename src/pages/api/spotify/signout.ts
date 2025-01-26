import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
    cookies.delete("spotify_access_token", { path: "/" });
    const redirectTo = url.searchParams.get("redirect_to") ?? "/";
    return redirect(redirectTo);
};