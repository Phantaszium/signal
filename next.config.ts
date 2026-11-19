import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Routes from before the PaperPuffin redesign, kept working for bookmarks
  // and links in emails already sent.
  async redirects() {
    return [
      { source: "/activity", destination: "/discover", permanent: false },
      { source: "/saved", destination: "/library", permanent: false },
      { source: "/topics", destination: "/research", permanent: false },
      { source: "/watchlist", destination: "/research", permanent: false },
      { source: "/profile", destination: "/research", permanent: false },
    ];
  },
};

export default nextConfig;
