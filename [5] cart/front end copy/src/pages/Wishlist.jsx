import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import Alert from "../components/Alert.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import StockBadge from "../components/StockBadge.jsx";
import { getErrorMessage, getWishlist, removeFromWishlist } from "../services/api.js";
import { formatPrice, handleImageError } from "../utils/format.js";

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null); // null until the first load finishes
  const [loadError, setLoadError] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    let active = true;
    getWishlist()
      .then((wishlist) => active && setItems(wishlist))
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) navigate("/login", { replace: true });
        else setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleRemove = async (productId) => {
    setRemovingId(productId);
    setRemoveError("");
    try {
      await removeFromWishlist(productId);
      setItems((prev) => prev.filter((item) => item._id !== productId));
    } catch (error) {
      setRemoveError(getErrorMessage(error, "Could not remove this product."));
    } finally {
      setRemovingId(null);
    }
  };

  let content;
  if (loadError) {
    content = (
      <StatusMessage tone="error" title="Unable to load wishlist">
        Please check that the server is running and try again.
      </StatusMessage>
    );
  } else if (items === null) {
    content = (
      <div className="py-16">
        <Spinner label="Loading your wishlist..." />
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <StatusMessage title="Your wishlist is empty ❤️">
        <Link to="/products" className="font-semibold text-brand-600 hover:text-brand-700">
          Browse products
        </Link>
      </StatusMessage>
    );
  } else {
    content = (
      <>
        <p className="mb-4 text-sm text-slate-500">
          {items.length} saved item{items.length === 1 ? "" : "s"}
        </p>
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item._id}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:flex-row"
            >
              <div className="aspect-[4/3] shrink-0 bg-slate-100 sm:aspect-square sm:w-44">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  onError={handleImageError}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="flex flex-1 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <span className="text-xs font-semibold tracking-wide text-brand-600 uppercase">{item.category}</span>
                  <h2 className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{item.name}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-lg font-extrabold text-slate-900">{formatPrice(item.price)}</span>
                    <StockBadge stock={item.stock} />
                  </div>
                </div>

                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <Link
                    to={`/products/${item._id}`}
                    className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:ring-4 focus:ring-brand-100 focus:outline-none"
                  >
                    View Details
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemove(item._id)}
                    disabled={removingId === item._id}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removingId === item._id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">My Wishlist</h1>
        <p className="mt-1 text-sm text-slate-500">Products you have saved for later.</p>
      </div>

      <Alert>{removeError}</Alert>
      {content}
    </AppLayout>
  );
}
