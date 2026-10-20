/** @type {import('next').NextConfig} */
const nextConfig = {
  // nodemailer talks raw TCP/TLS to the SMTP server, so it must run as a
  // normal Node dependency instead of being bundled into the route handler.
  serverExternalPackages: ['nodemailer'],
  images: {
    unoptimized: true,
  },
  // The service worker script must never be served from the browser HTTP cache,
  // otherwise clients can keep running an outdated worker after a deploy.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ]
  },
}

export default nextConfig
