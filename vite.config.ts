import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Content Security Policy for production builds (dev needs inline scripts for hot reload).
 * Only this site's own scripts run, nothing can be framed or posted elsewhere, and the
 * page can talk only to its own origin. Hosts add frame-ancestors via headers (meta can't).
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const csp = (): Plugin => ({
  name: "qelvo-csp",
  apply: "build",
  transformIndexHtml: (html) => html.replace("<head>", `<head>
    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig({
  plugins: [react(), csp()],
  server: { port: 5173, proxy: { "/api": "http://localhost:8787" } },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
