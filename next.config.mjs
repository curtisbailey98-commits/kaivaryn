/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Guided imports post the file text through a server action (default limit is 1 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
