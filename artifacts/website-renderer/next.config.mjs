/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve all tenant sites from the same Next.js app
  // Domain routing is handled at the application layer (middleware + host header)

  images: {
    // Allow images from our CDN and common external sources
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
    ],
  },

  // Disable the x-powered-by header
  poweredByHeader: false,

  // Allow the API server origin for ISR revalidation
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
