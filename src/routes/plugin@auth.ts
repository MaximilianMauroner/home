import { QwikAuth$ } from "@auth/qwik";
import Spotify from "@auth/qwik/providers/spotify";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  () => ({
    providers: [
      Spotify({
        clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
        clientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET,
        authorization: { params: { scope: "user-read-email user-library-read" } },
      }),
    ],
    secret: import.meta.env.VITE_AUTH_SECRET,
    trustHost: true,
  }),
);
