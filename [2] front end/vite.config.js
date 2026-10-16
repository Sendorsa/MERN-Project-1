import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The backend does not enable CORS, so the browser cannot call
// http://localhost:8000 directly from the Vite origin. Proxying /customers
// through the dev server keeps every request same-origin, which also lets the
// HttpOnly auth cookie flow without any cross-site restrictions.
const BACKEND_URL = "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/customers": {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/customers": {
        target: BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
});
