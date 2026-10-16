import withPWA from "next-pwa"

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  turbopack: {},
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    // Mode attente posé au build : noindex aussi sur les fichiers statiques hors middleware.
    const waiting =
      process.env.SITE_WAITING_MODE === "true"
        ? [
            {
              source: "/:path*",
              headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
            },
          ]
        : []
    return [
      ...waiting,
      {
        source: "/sprite.svg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ]
  },
  images: {
    remotePatterns: [
      // Hôte exact du projet Supabase de production, jamais de joker d'hôte :
      // sinon le projet de n'importe qui passerait par l'optimiseur d'images.
      {
        protocol: "https",
        hostname: "ymdtwtlnenxpfnxdipek.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "ymdtwtlnenxpfnxdipek.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
}

export default pwaConfig(nextConfig)
