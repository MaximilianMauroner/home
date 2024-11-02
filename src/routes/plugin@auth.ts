import Spotify from "@auth/core/providers/spotify";
import { QwikAuth$ } from "@auth/qwik";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  ({ env }) => {
    return {
      providers: [Spotify({
        clientId: env.get("SPOTIFY_CLIENT_ID"),
        clientSecret: env.get("SPOTIFY_CLIENT_SECRET"),
        authorization: { params: { scope: "user-read-email user-library-read" } },
      })],
      secret: env.get("AUTH_SECRET"),
      callbacks: {
        jwt: async ({ token, account }) => {
          if (account) {
            token.accessToken = (account as any).access_token;
          }
          return token;
        },
        session: async ({ session, token }) => {
          if (token) {

            (session as any).accessToken = token.accessToken;
          }
          return session;
        },
      },
    };
  }
);
