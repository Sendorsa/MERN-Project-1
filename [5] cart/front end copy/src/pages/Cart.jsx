import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import StockBadge from "../components/StockBadge.jsx";
import {
  fetchCart,
  removeFromCart,
  selectCartCount,
  selectCartError,
  selectCartItems,
  selectCartLoading,
  updateQuantity,
} from "../store/cartSlice.js";
import { formatPrice, handleImageError } from "../utils/format.js";

const stepButtonClass =
  "flex h-9 w-9 items-center justify-center text-lg font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40";

export default function Cart() {
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const cartCount = useSelector(selectCartCount);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [checkoutNote, setCheckoutNote] = useState(false);

  // Re-fetch on open so prices and stock are current.
  useEffect(() => {
    const request = dispatch(fetchCart());
    return () => request.abort();
  }, [dispatch]);

  const refreshCart = () => dispatch(fetchCart());

  // Runs one cart thunk for a row; .unwrap() rethrows the rejection message.
  const run = async (productId, thunk) => {
    setBusyId(productId);
    setActionError("");
    try {
      await dispatch(thunk).unwrap();
    } catch (message) {
      setActionError(message);
    } finally {
      setBusyId(null);
    }
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  let content;
  if (loading && cartItems.length === 0) {
    content = (
      <div className="py-16">
        <Spinner label="Loading your cart..." />
      </div>
    );
  } else if (error) {
    content = (
      <StatusMessage tone="error" title="Unable to load your cart.">
        <button type="button" onClick={refreshCart} className="font-semibold text-red-700 underline">
          Try again
        </button>
      </StatusMessage>
    );
  } else if (cartItems.length === 0) {
    content = (
      <StatusMessage title="Your cart is empty 🛒">
        <Link to="/products" className="font-semibold text-brand-600 hover:text-brand-700">
          Browse products
        </Link>
      </StatusMessage>
    );
  } else {
    content = (
      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="space-y-4 lg:col-span-2">
          {cartItems.map(({ product, quantity }) => {
            const busy = busyId === product._id;
            return (
              <li
                key={product._id}
                className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex-row"
              >
                <Link to={`/products/${product._id}`} className="aspect-[4/3] shrink-0 bg-slate-100 sm:aspect-square sm:w-36">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    onError={handleImageError}
                    className="h-full w-full object-cover"
                  />
                </Link>

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-base font-bold text-slate-900">{product.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{formatPrice(product.price)} each</p>
                    </div>
                    <StockBadge stock={product.stock} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-lg border border-slate-300">
                        <button
                          type="button"
                          aria-label={`Decrease quantity of ${product.name}`}
                          onClick={() => run(product._id, updateQuantity({ productId: product._id, quantity: quantity - 1 }))}
                          disabled={busy || quantity <= 1}
                          className={stepButtonClass}
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-slate-900" aria-live="polite">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={`Increase quantity of ${product.name}`}
                          onClick={() => run(product._id, updateQuantity({ productId: product._id, quantity: quantity + 1 }))}
                          disabled={busy || quantity >= product.stock}
                          className={stepButtonClass}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => run(product._id, removeFromCart(product._id))}
                        disabled={busy}
                        className="text-sm font-semibold text-slate-500 transition hover:text-red-600 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-lg font-extrabold text-slate-900">{formatPrice(product.price * quantity)}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Items</dt>
              <dd className="font-semibold text-slate-900">{cartCount}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 text-base">
              <dt className="font-bold text-slate-900">Subtotal</dt>
              <dd className="font-extrabold text-slate-900">{formatPrice(subtotal)}</dd>
            </div>
          </dl>
          {/* UI only: checkout is a later lab. */}
          <button
            type="button"
            onClick={() => setCheckoutNote(true)}
            className="mt-5 w-full rounded-lg bg-accent-400 px-6 py-3 text-base font-bold text-slate-900 shadow-md shadow-amber-500/20 transition hover:brightness-95 focus:ring-4 focus:ring-amber-200 focus:outline-none"
          >
            Proceed to Checkout
          </button>
          {checkoutNote && (
            <p role="status" className="mt-3 text-center text-xs text-slate-500">
              Checkout is not available yet.
            </p>
          )}
        </aside>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">My Cart</h1>
        <p className="mt-1 text-sm text-slate-500">Review your items before checkout.</p>
      </div>

      <Alert>{actionError}</Alert>
      {content}
    </AppLayout>
  );
}
