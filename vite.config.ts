import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Full Content Security Policy, delivered as an HTTP response header.
// frame-ancestors and upgrade-insecure-requests are ONLY effective when delivered
// this way — browsers ignore them inside a <meta> tag (CSP3 §3.3), which is where
// they used to live. Keep this in sync with the <meta> fallback CSP in index.html
// (that copy intentionally omits those two header-only directives).
// Google Fonts: the stylesheet is served from fonts.googleapis.com (style-src) and
// the woff2 font files from fonts.gstatic.com (font-src).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  // blob: media is used to play backend TTS audio returned from /api/audio/speak
  "media-src 'self' blob:",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' http://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'", // header-only: blocks framing / clickjacking
  "form-action 'self'",
  "upgrade-insecure-requests", // header-only: no-op on http, active on https
].join("; ");

// Security headers applied to both dev server and preview
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": CSP,
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-XSS-Protection": "0",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // bind dev server to localhost only — not exposed to the network
    host: "localhost",
    // fail fast if port is taken (prevents accidentally binding a stale server)
    strictPort: true,
    headers: securityHeaders,
  },
  preview: {
    // bind preview server to localhost only
    host: "localhost",
    strictPort: true,
    headers: securityHeaders,
  },
});
