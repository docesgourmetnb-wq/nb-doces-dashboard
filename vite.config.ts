import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function manualChunks(id: string) {
  if (!id.includes("node_modules")) return undefined;

  if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("react-router-dom")) {
    return "vendor-react";
  }

  if (id.includes("@supabase")) {
    return "vendor-supabase";
  }

  if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("class-variance-authority")) {
    return "vendor-ui";
  }

  if (id.includes("recharts")) {
    return "vendor-charts";
  }

  return "vendor";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
