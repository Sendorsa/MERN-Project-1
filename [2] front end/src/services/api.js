import axios from "axios";

// Backend: http://localhost:8000. In development, requests go to the Vite dev
// server, which proxies /customers/* to the backend (see vite.config.js),
// because the backend does not send CORS headers. Set VITE_API_URL to call a
// backend that does allow this origin directly.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Pulls a human-readable message out of an axios error.
export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.status >= 500) return "Server error. Please try again later.";
  if (error.request && !error.response) return "Cannot reach the server. Is the backend running on port 8000?";
  return fallback;
};

export default api;
