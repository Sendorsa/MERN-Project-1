import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  addToCart as apiAddToCart,
  getCart,
  getErrorMessage,
  removeFromCart as apiRemoveFromCart,
  updateCartQuantity as apiUpdateCartQuantity,
} from "../services/api.js";

// Each thunk wraps the existing service call. Every cart endpoint returns the
// full cart, so a fulfilled thunk simply replaces `items`. Failures reject with
// a readable message: `dispatch(thunk()).unwrap()` throws that string.
const cartThunk = (type, request, fallback) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await request(arg);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, fallback));
    }
  });

export const fetchCart = cartThunk("cart/fetch", () => getCart(), "Unable to load your cart.");
export const addToCart = cartThunk("cart/add", (productId) => apiAddToCart(productId), "Could not add to cart.");
export const updateQuantity = cartThunk(
  "cart/updateQuantity",
  ({ productId, quantity }) => apiUpdateCartQuantity(productId, quantity),
  "Could not update your cart."
);
export const removeFromCart = cartThunk(
  "cart/remove",
  (productId) => apiRemoveFromCart(productId),
  "Could not update your cart."
);

const initialState = {
  items: [],
  loading: false,
  error: null,
};

const setItems = (state, action) => {
  state.items = action.payload;
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    // Called on logout: the store outlives the session, so drop the old cart.
    clearCart: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false;
        // An aborted request (page left / logged out) is not a load failure.
        if (!action.meta.aborted) state.error = action.payload;
      })
      // Mutation errors are shown where the click happened, not stored here.
      .addCase(addToCart.fulfilled, setItems)
      .addCase(updateQuantity.fulfilled, setItems)
      .addCase(removeFromCart.fulfilled, setItems);
  },
});

export const { clearCart } = cartSlice.actions;

export const selectCartItems = (state) => state.cart.items;
export const selectCartLoading = (state) => state.cart.loading;
export const selectCartError = (state) => state.cart.error;
// Total units, not unique products: Keyboard x2 + Mouse x1 = 3.
export const selectCartCount = (state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0);

export default cartSlice.reducer;
