import type { RequestHandler } from "@builder.io/qwik-city";

async function getPlaylists(session: any) {
    if (!session?.accessToken) {
        throw new Error('Invalid session');
    }

    const response = await fetch('https://api.spotify.com/v1/me/playlists', {
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.statusText}`);
    }

    return response.json();
}

export const onGet: RequestHandler = async (event) => {
    try {
        const session = event.sharedMap.get('session');
        if (!session || new Date(session.expires) < new Date()) {
            event.redirect(302, '/api/spotify/login');
            return;
        }

        const data = await getPlaylists(session);
        event.json(200, data);
    } catch (error) {
        if (error instanceof Response) throw error;
        event.json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
