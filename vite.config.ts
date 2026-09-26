import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Local development only: forward API calls to `netlify dev` (port 8888),
  // which runs the Netlify Functions. Production serves both from one origin.
  server: {
    proxy: {
      "/api": { target: "http://localhost:8888", changeOrigin: false },
    },
  },
})
