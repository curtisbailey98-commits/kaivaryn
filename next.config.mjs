/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Guided imports post the file text through a server action (default limit is 1 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async redirects() {
    return [
      // Old URL read like a SpotOn partnership. There isn't one.
      { source: "/partners/spoton", destination: "/spoton", permanent: true },
    ];
  },
};

export default nextConfig;
