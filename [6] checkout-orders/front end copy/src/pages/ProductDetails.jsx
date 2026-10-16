import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import StockBadge from "../components/StockBadge.jsx";
import { getProductById } from "../services/api.js";
import { addToCart, selectCartItems } from "../store/cartSlice.js";
import { formatPrice, handleImageError } from "../utils/format.js";

const errorTitle = (status) => {
  if (status === 404) return "Product not found.";
  if (status === 400) return "This product link is invalid.";
  return "Something went wrong while loading this product.";
};

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Loading is derived: the result belongs to a different id than the URL's.
  const [result, setResult] = useState({ id: null, product: null, errorStatus: null });
  const loading = result.id !== id;
  const dispatch = useDispatch();
  const cartItems = useSelector(selectCartItems);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok: boolean, text: string }

  useEffect(() => {
    const controller = new AbortController();

    getProductById(id, { signal: controller.signal })
      .then((product) => setResult({ id, product, errorStatus: null }))
      .catch((error) => {
        if (error.code === "ERR_CANCELED") return;
        setResult({ id, product: null, errorStatus: error.response?.status ?? "network" });
      });

    return () => controller.abort();
  }, [id]);

  // Return to the list the user came from (keeping their filters) when there
  // is one in history; otherwise fall back to the full product list.
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/products");
  };

  const { product, errorStatus } = result;
  const inCart = cartItems.find((item) => item.product._id === id)?.quantity ?? 0;

  const handleAddToCart = async () => {
    setAdding(true);
    setFeedback(null);
    try {
      await dispatch(addToCart(id)).unwrap();
      setFeedback({ ok: true, text: "Added to cart." });
    } catch (message) {
      setFeedback({ ok: false, text: message });
    } finally {
      setAdding(false);
    }
  };

  return (
    <AppLayout>
      <button
        type="button"
        onClick={goBack}
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
      >
        <span aria-hidden="true">&larr;</span> Back to products
      </button>

      {loading && (
        <div className="py-16">
          <Spinner label="Loading product..." />
        </div>
      )}

      {!loading && errorStatus && (
        <StatusMessage tone="error" title={errorTitle(errorStatus)}>
          <Link to="/products" className="font-semibold text-brand-600 hover:text-brand-700">
            Browse all products
          </Link>
        </StatusMessage>
      )}

      {!loading && product && (
        <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:grid-cols-2 lg:gap-12 lg:p-8">
          <div className="overflow-hidden rounded-xl bg-slate-100">
            <img
              src={product.image}
              alt={product.name}
              onError={handleImageError}
              className="aspect-square h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide text-brand-600 uppercase">{product.category}</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{product.name}</h1>

            <p className="mt-4 text-3xl font-extrabold text-slate-900">{formatPrice(product.price)}</p>
            <p className="mt-1 text-xs text-slate-500">Inclusive of all taxes</p>

            <div className="mt-4">
              <StockBadge stock={product.stock} />
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-bold text-slate-900">Description</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-line text-slate-600">{product.description}</p>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-slate-500">Category</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{product.category}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Stock</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{product.stock} units</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.stock === 0 || adding}
              className="mt-8 w-full rounded-lg bg-accent-400 px-6 py-3.5 text-base font-bold text-slate-900 shadow-md shadow-amber-500/20 transition hover:brightness-95 focus:ring-4 focus:ring-amber-200 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
            >
              {product.stock === 0 ? "Out of Stock" : adding ? "Adding…" : "Add to Cart"}
            </button>
            {inCart > 0 && (
              <p className="mt-3 text-sm text-slate-600">
                In your cart: <span className="font-semibold text-slate-900">{inCart}</span> ·{" "}
                <Link to="/cart" className="font-semibold text-brand-600 hover:text-brand-700">
                  View cart
                </Link>
              </p>
            )}
            {feedback && (
              <p role="status" className={`mt-2 text-sm font-medium ${feedback.ok ? "text-green-700" : "text-red-600"}`}>
                {feedback.text}
              </p>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
