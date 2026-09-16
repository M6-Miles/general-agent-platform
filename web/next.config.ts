import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow Playwright and local parallel instances to use an isolated build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    // 性能优化：自动优化大型包的导入
    optimizePackageImports: [
      'lucide-react',
      '@xyflow/react',
      'reactflow',
      'recharts'
    ],
  },
  // 启用 SWC 编译器优化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Turbopack 配置
  turbopack: {
    // The repository also has a root Playwright lockfile. Keep Turbopack
    // resolution anchored to this frontend package explicitly.
    root: process.cwd(),
    resolveAlias: {
      canvas: "./empty-module.js",
    },
  },
};

export default nextConfig;
