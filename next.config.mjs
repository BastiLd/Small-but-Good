const isProd = process.env.NODE_ENV === "production";
const repoName = "Small-but-Good";
const basePath = isProd ? `/${repoName}` : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  basePath,
  assetPrefix: isProd ? `${basePath}/` : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};

export default nextConfig;