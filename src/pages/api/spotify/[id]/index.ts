import type { APIRoute } from "astro";

export const prerender = false;

async function getPlaylistTracks(playlistId: string, accessToken: string) {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Sort tracks by name
    data.items.sort((a: any, b: any) => {
        const nameA = a.track.name.toLowerCase();
        const nameB = b.track.name.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    return data;
}

export const GET: APIRoute = async ({ params, cookies, redirect }) => {
    try {
        const accessToken = cookies.get("spotify_access_token")?.value;

        if (!accessToken) {
            return redirect("/api/spotify/login");
        }

        const playlistId = params.id;
        if (!playlistId) {
            return new Response(JSON.stringify({ error: "Playlist ID is required" }), { status: 400 });
        }

        const data = await getPlaylistTracks(playlistId, accessToken);
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
