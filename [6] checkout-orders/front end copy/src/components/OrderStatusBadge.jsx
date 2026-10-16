// Pill for an order's paymentStatus (PENDING | PAID | REFUNDED) or
// status (PENDING | PLACED | CANCELLED).
const STYLES = {
  PAID: "bg-green-50 text-green-700 ring-green-600/20",
  PLACED: "bg-green-50 text-green-700 ring-green-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CANCELLED: "bg-red-50 text-red-700 ring-red-600/20",
  REFUNDED: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export default function OrderStatusBadge({ value }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${STYLES[value] ?? STYLES.PENDING}`}
    >
      {value.charAt(0) + value.slice(1).toLowerCase()}
    </span>
  );
}
