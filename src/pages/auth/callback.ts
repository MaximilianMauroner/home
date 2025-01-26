export const prerender = false;
import { getSpotifyTokens } from '@/utils/spotify';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
    const code = url.searchParams.get('code');

    if (!code) {
        return new Response('No code provided - full URL logged', { status: 400 });
    }

    try {
        const { access_token, refresh_token } = await getSpotifyTokens(code);

        // Store tokens securely in httpOnly cookies
        cookies.set('spotify_access_token', access_token, {
            httpOnly: true,
            path: '/',
            maxAge: 3600
        });

        cookies.set('spotify_refresh_token', refresh_token, {
            httpOnly: true,
            path: '/',
            maxAge: 30 * 24 * 3600
        });

        return redirect('/other/elo-compare');
    } catch (error) {
        return new Response('Authentication failed', { status: 500 });
    }
};
