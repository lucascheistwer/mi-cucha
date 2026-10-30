import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/viajes/:tripId/estadisticas",
        destination: "/viajes/:tripId/resumen",
        permanent: true,
      },
    ];
  },
};

export default withSerwist(nextConfig);
