import type { RequestHandler } from "@builder.io/qwik-city";

interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
        name: string;
        images: Array<{ url: string }>;
    };
}

interface SpotifyResponse {
    tracks: SpotifyTrack[];
}

async function getByTrackIds(trackIds: string[], session: any): Promise<SpotifyResponse> {
    if (!session?.accessToken || !trackIds.length) {
        throw new Error('Invalid session or track IDs');
    }

    const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${trackIds.join(',')}`, {
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
        }
    });

    if (!response.ok) {
        throw new Error(`Spotify API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}

export const onGet: RequestHandler = async (event) => {
    try {
        const session = event.sharedMap.get('session');
        if (!session || new Date(session.expires) < new Date()) {
            event.redirect(302, '/api/spotify/login');
            return
        }

        const trackIds = event.url.searchParams.get('ids')?.split(',') || [];
        if (!trackIds.length) {
            event.json(400, { error: 'No track IDs provided' });
            return
        }

        const data = await getByTrackIds(trackIds, session);
        event.json(200, data);
    } catch (error) {
        if (error instanceof Response) throw error; // Handle redirects
        event.json(500, { error: error instanceof Error ? error.message : 'Unknown error' });
    }
};
