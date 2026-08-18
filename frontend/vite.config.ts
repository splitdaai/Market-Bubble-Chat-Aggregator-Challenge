import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

/**
 * Dev-only: serve the repo's Vercel functions (`../api/*.ts`) under `/api/*`
 * so LIVE mode (X + YouTube chat) works on `npm run dev` exactly like
 * production. Production never touches this — Vercel runs the functions.
 * Resolves `/api/foo` → api/foo.ts and `/api/foo/<id>` → api/foo/[id].ts.
 */
function vercelApiDev(): Plugin {
  const apiDir = path.resolve(__dirname, "../api");
  return {
    name: "vercel-api-dev",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        const url = new URL(req.url, "http://localhost");
        const seg = url.pathname.slice("/api/".length).split("/").filter(Boolean);
        if (seg.length === 0) return next();
        const flat = path.join(apiDir, `${seg.join("/")}.ts`);
        const dyn = path.join(apiDir, seg[0], "[id].ts"); // /api/foo/<id>
        const nested = seg.length === 3 ? path.join(apiDir, seg[0], "[platform]", `${seg[2]}.ts`) : ""; // /api/auth/<platform>/start
        const file = fs.existsSync(flat) ? flat : seg.length === 2 && fs.existsSync(dyn) ? dyn : nested && fs.existsSync(nested) ? nested : null;
        if (!file || !file.startsWith(apiDir)) return next();
        try {
          const mod = await server.ssrLoadModule(file);
          const query: Record<string, string> = Object.fromEntries(url.searchParams);
          if (file === dyn) query.id = seg[1];
          if (file === nested) query.platform = seg[1];
          (req as unknown as { query: Record<string, string> }).query = query;
          await mod.default(req, res);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "dev api failed", detail: e instanceof Error ? e.message : String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vercelApiDev()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "motion-vendor": ["framer-motion"],
          "socket-vendor": ["socket.io-client"],
          "grid-vendor": ["react-grid-layout"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  server: {
    port: 5184,
    host: true,
  },
});
