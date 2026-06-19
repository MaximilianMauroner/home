/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly LEAVEIFY_SPOTIFY_REDIRECT_URI?: string;
  readonly LEAVEIFY_TIDAL_REDIRECT_URI?: string;
  readonly LEAVEIFY_DEBUG?: string;
  readonly SPOTIFY_CLIENT_ID: string;
  readonly SPOTIFY_REDIRECT_URI: string;
  readonly TIDAL_CLIENT_ID?: string;
  readonly TIDAL_CLIENT_SECRET?: string;
  readonly TIDAL_COUNTRY_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
