import type { APIRoute } from "astro";

export const prerender = false;

async function getPlaylists(accessToken: string) {
    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.statusText}`);
    }

    return response.json();
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
    try {
        const accessToken = cookies.get("spotify_access_token")?.value;

        if (!accessToken) {
            return redirect("/api/spotify/login");
        }

        const data = await getPlaylists(accessToken);
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            { status: 500 }
        );
    }
};