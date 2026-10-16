import { useState } from "react";
import { Link } from "react-router-dom";
import StockBadge from "./StockBadge.jsx";
import { addToWishlist, getErrorMessage } from "../services/api.js";
import { formatPrice, handleImageError } from "../utils/format.js";

export default function ProductCard({ product }) {
  const { _id, name, image, price, category, stock } = product;
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { ok: boolean, text: string }

  const handleWishlist = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const { data } = await addToWishlist(_id);
      setFeedback({ ok: true, text: data.message });
    } catch (error) {
      setFeedback({ ok: false, text: getErrorMessage(error, "Could not add to wishlist.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="aspect-[4/3] overflow-hidden bg-slate-100">
        <img
          src={image}
          alt={name}
          loading="lazy"
          onError={handleImageError}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* flex-1 pushes the button to the bottom so buttons line up across a row */}
        <div className="flex-1">
          <span className="text-xs font-semibold tracking-wide text-brand-600 uppercase">{category}</span>
          <h3 className="mt-1 line-clamp-2 text-base font-bold text-slate-900">{name}</h3>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-lg font-extrabold text-slate-900">{formatPrice(price)}</span>
          <StockBadge stock={stock} />
        </div>

        <Link
          to={`/products/${_id}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:ring-4 focus:ring-brand-100 focus:outline-none"
        >
          View Details
        </Link>

        <button
          type="button"
          onClick={handleWishlist}
          disabled={saving}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 focus:ring-4 focus:ring-rose-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">♡</span> {saving ? "Adding…" : "Add to Wishlist"}
        </button>
        {feedback && (
          <p role="status" className={`mt-2 text-center text-xs font-medium ${feedback.ok ? "text-green-700" : "text-red-600"}`}>
            {feedback.text}
          </p>
        )}
      </div>
    </article>
  );
}
