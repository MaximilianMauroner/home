import { nodeServerAdapter } from "@builder.io/qwik-city/adapters/node-server/vite";
import { extendConfig } from "@builder.io/qwik-city/vite";
import baseConfig from "../../vite.config";

export default extendConfig(baseConfig, () => {
  return {
    build: {
      ssr: true,
      rollupOptions: {
        input: ["src/entry.fastify.tsx", "@qwik-city-plan"],
      },
    },
    plugins: [nodeServerAdapter({
      name: "fastify",
      ssg: {
        include: ["/*"],
        exclude: [
          "/sitemap.xml",
          "/api/*",    // API routes should be dynamic
          "/auth/*"    // Auth routes should be dynamic
        ],
        origin: "https://www.mauroner.net",
      },
    })],
  };
});
