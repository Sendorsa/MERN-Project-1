const LOW_STOCK_THRESHOLD = 5;

export default function StockBadge({ stock }) {
  let style = "bg-green-50 text-green-700 ring-green-600/20";
  let label = `In stock: ${stock}`;

  if (stock === 0) {
    style = "bg-red-50 text-red-700 ring-red-600/20";
    label = "Out of stock";
  } else if (stock <= LOW_STOCK_THRESHOLD) {
    style = "bg-amber-50 text-amber-700 ring-amber-600/20";
    label = `Only ${stock} left`;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      {label}
    </span>
  );
}
