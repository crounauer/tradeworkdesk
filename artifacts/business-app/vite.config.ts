/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH || "/";
export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: "autoUpdate",
    injectRegister: null,
    includeAssets: ["favicon-32.png", "apple-touch-icon.png", "icon-192.png", "icon-512.png"],
    manifest: {
      name: "TradeWorkDesk",
      short_name: "TradeWorkDesk",
      description: "Professional Boiler Service Management",
      start_url: basePath,
      display: "standalone",
      background_color: "#f8fafc",
      theme_color: "#1d4ed8",
      icons: [{
        src: "icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      }, {
        src: "icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }, {
        src: "icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }]
    },
    workbox: {
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
      runtimeCaching: [{
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: {
            maxEntries: 30,
            maxAgeSeconds: 60 * 60 * 24 * 365
          }
        }
      }],
      navigateFallback: "index.html",
      navigateFallbackDenylist: [/^\/api\//, /^\/sitemap.*\.xml$/, /^\/robots\.txt$/, /^\/[0-9a-f]{32}\.txt$/],
      importScripts: ["sw-custom.js"]
    },
    devOptions: {
      enabled: false
    }
  })],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@website-renderer": path.resolve(import.meta.dirname, "..", "website-renderer", "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets")
    },
    dedupe: ["react", "react-dom"]
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          const after = id.split("node_modules/").pop() as string;
          const parts = after.split("/");
          const pkg = after.startsWith("@") ? `${parts[0]}/${parts[1]}` : parts[0];
          // Heavy, lazy-only visualisation libs — kept out of every other chunk so
          // marketing/location pages (no charts/maps) never load them.
          if (/^(recharts|recharts-scale|victory-vendor|leaflet|react-leaflet)$/.test(pkg) || pkg.startsWith("@react-leaflet") || /^d3-/.test(pkg)) {
            return "vendor-viz";
          }
          if (/^(react|react-dom|scheduler)$/.test(pkg)) return "vendor-react";
          if (pkg.startsWith("@tanstack")) return "vendor-query";
          if (pkg.startsWith("@supabase")) return "vendor-supabase";
          if (pkg.startsWith("@radix-ui")) return "vendor-ui";
          if (pkg === "lucide-react") return "vendor-icons";
          if (/^(react-hook-form|@hookform|zod)$/.test(pkg)) return "vendor-forms";
          // Everything else (react-is, clsx, tailwind-merge, etc.) — a neutral
          // shared chunk so small shared deps never get pulled into vendor-viz.
          return "vendor-common";
        }
      }
    }
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true
      }
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
      allow: [
        path.resolve(import.meta.dirname),
        path.resolve(import.meta.dirname, "..", "website-renderer"),
        path.resolve(import.meta.dirname, "..", "..")
      ]
    }
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true
  },
  test: {
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: playwright({}),
          instances: [{
            browser: 'chromium'
          }]
        }
      }
    }]
  }
});