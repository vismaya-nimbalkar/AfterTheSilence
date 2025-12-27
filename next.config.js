/** @type {import('next').NextConfig} */
module.exports = {
  experimental: {
    serverActions: {},
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // 👇 REQUIRED to silence Turbopack + Webpack conflict
  turbopack: {},

  webpack: (config) => {
    config.plugins.push(new VeliteWebpackPlugin());
    return config;
  },
};

class VeliteWebpackPlugin {
  static started = false;

  apply(compiler) {
    compiler.hooks.beforeCompile.tapPromise(
      'VeliteWebpackPlugin',
      async () => {
        if (VeliteWebpackPlugin.started) return;
        VeliteWebpackPlugin.started = true;

        const dev = compiler.options.mode === 'development';
        const { build } = await import('velite');

        await build({ watch: dev, clean: !dev });
      }
    );
  }
}