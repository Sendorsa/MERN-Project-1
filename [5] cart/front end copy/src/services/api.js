import axios from "axios";

// The backend enables CORS for this origin with credentials, so the browser
// talks to it directly. Override with VITE_API_URL (e.g. in .env.local).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
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

// --- Customers ------------------------------------------------------------

export const registerCustomer = (payload) => api.post("/customers/register", payload);

export const loginCustomer = (credentials) => api.post("/customers/login", credentials);

export const logoutCustomer = () => api.post("/customers/logout");

export const getCurrentCustomer = async () => {
  const { data } = await api.get("/customers/me");
  return data.customer;
};

// --- Products -------------------------------------------------------------

/**
 * GET /products with optional filters. Empty filters are left out so the
 * backend only receives the conditions actually in use.
 */
export const getProducts = async ({ search, category } = {}, { signal } = {}) => {
  const params = {};
  if (search?.trim()) params.search = search.trim();
  if (category) params.category = category;

  const { data } = await api.get("/products", { params, signal });
  return data.products;
};

export const getProductById = async (id, { signal } = {}) => {
  const { data } = await api.get(`/products/${encodeURIComponent(id)}`, { signal });
  return data.product;
};

// --- Wishlist -------------------------------------------------------------

export const addToWishlist = (productId) => api.post(`/wishlist/${encodeURIComponent(productId)}`);

export const getWishlist = async () => {
  const { data } = await api.get("/wishlist");
  return data.wishlist;
};

export const removeFromWishlist = (productId) => api.delete(`/wishlist/${encodeURIComponent(productId)}`);

// --- Cart -----------------------------------------------------------------
// Every cart endpoint responds with the full, populated cart.

export const getCart = async () => {
  const { data } = await api.get("/cart");
  return data.cart;
};

export const addToCart = async (productId) => {
  const { data } = await api.post(`/cart/${encodeURIComponent(productId)}`);
  return data.cart;
};

export const updateCartQuantity = async (productId, quantity) => {
  const { data } = await api.patch(`/cart/${encodeURIComponent(productId)}`, { quantity });
  return data.cart;
};

export const removeFromCart = async (productId) => {
  const { data } = await api.delete(`/cart/${encodeURIComponent(productId)}`);
  return data.cart;
};

export default api;
