import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O gerador de PDF corre só no servidor e não deve ser empacotado pelo bundler.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
