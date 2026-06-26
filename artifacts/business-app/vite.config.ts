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
      navigateFallbackDenylist: [/^\/api\//],
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
        manualChunks: {
          "vendor-react": ["react", "react-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-popover", "@radix-ui/react-label", "@radix-ui/react-checkbox"],
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-icons": ["lucide-react"],
          "vendor-charts": ["recharts"],
          "vendor-map": ["leaflet", "react-leaflet"]
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
      allow: [path.resolve(import.meta.dirname, "..", "website-renderer")]
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