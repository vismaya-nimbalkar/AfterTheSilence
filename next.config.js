/** @type {import('next').NextConfig} */
module.exports = {
  // We keep this to avoid the conflict warnings you saw earlier
  turbopack: {},

  // We keep this for clean logs
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  experimental: {
    serverActions: {},
  },

  // We REMOVED the webpack plugin block here because
  // we are now handling Velite in package.json
};
