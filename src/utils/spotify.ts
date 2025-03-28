const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-top-read'
].join(' ');

export const getSpotifyAuthorizationUrl = () => {
    const params = new URLSearchParams({
        client_id: import.meta.env.SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: import.meta.env.SPOTIFY_REDIRECT_URI,
        scope: SCOPES,
        show_dialog: 'true'
    });

    return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
};

export const getSpotifyTokens = async (code: string) => {
    const response = await fetch(SPOTIFY_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // 'Authorization': `Basic ${btoa(`${import.meta.env.SPOTIFY_CLIENT_ID}:${import.meta.env.SPOTIFY_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: import.meta.env.SPOTIFY_REDIRECT_URI
        })
    });

    return response.json();
};