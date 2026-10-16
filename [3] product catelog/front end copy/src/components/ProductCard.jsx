import { Link } from "react-router-dom";
import StockBadge from "./StockBadge.jsx";
import { formatPrice, handleImageError } from "../utils/format.js";

export default function ProductCard({ product }) {
  const { _id, name, image, price, category, stock } = product;

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
      </div>
    </article>
  );
}
