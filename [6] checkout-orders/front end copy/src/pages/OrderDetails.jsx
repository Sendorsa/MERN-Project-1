import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import OrderStatusBadge from "../components/OrderStatusBadge.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { getOrderById } from "../services/api.js";
import { FALLBACK_IMAGE, formatDate, formatPrice, handleImageError } from "../utils/format.js";

const errorTitle = (status) => {
  if (status === 404) return "Order not found.";
  if (status === 400) return "This order link is invalid.";
  return "Unable to load this order.";
};

export default function OrderDetails() {
  const { id } = useParams();

  // Loading is derived: the result belongs to a different id than the URL's.
  const [result, setResult] = useState({ id: null, order: null, errorStatus: null });
  const loading = result.id !== id;

  useEffect(() => {
    const controller = new AbortController();

    getOrderById(id, { signal: controller.signal })
      .then((order) => setResult({ id, order, errorStatus: null }))
      .catch((error) => {
        if (error.code === "ERR_CANCELED") return;
        setResult({ id, order: null, errorStatus: error.response?.status ?? "network" });
      });

    return () => controller.abort();
  }, [id]);

  const { order, errorStatus } = result;
  const address = order?.shippingAddress;

  return (
    <AppLayout>
      <Link
        to="/orders"
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
      >
        <span aria-hidden="true">&larr;</span> Back to orders
      </Link>

      {loading && (
        <div className="py-16">
          <Spinner label="Loading order..." />
        </div>
      )}

      {!loading && errorStatus && (
        <StatusMessage tone="error" title={errorTitle(errorStatus)}>
          <Link to="/orders" className="font-semibold text-brand-600 hover:text-brand-700">
            See all orders
          </Link>
        </StatusMessage>
      )}

      {!loading && order && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Order Details</h1>
            <p className="mt-1 break-all font-mono text-sm text-slate-500">{order._id}</p>
            <p className="mt-1 text-sm text-slate-500">Placed {formatDate(order.createdAt)}</p>
          </div>

          {order.status === "CANCELLED" && (
            <StatusMessage tone="error" title="This order was cancelled">
              {order.failureReason}{" "}
              {order.paymentStatus === "REFUNDED"
                ? "Your payment has been refunded."
                : "Your payment will be refunded."}
            </StatusMessage>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="text-lg font-bold text-slate-900">Items</h2>
              <ul className="mt-2 divide-y divide-slate-100">
                {order.items.map((item, index) => {
                  // A product deleted from the catalog populates to null.
                  const product = item.product;
                  return (
                    <li key={product?._id ?? index} className="flex items-center gap-4 py-4">
                      <img
                        src={product?.image ?? FALLBACK_IMAGE}
                        alt={product?.name ?? ""}
                        onError={handleImageError}
                        className="h-16 w-16 shrink-0 rounded-lg bg-slate-100 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-semibold text-slate-900">
                          {product?.name ?? "Product no longer available"}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Qty {item.quantity} × {formatPrice(item.price)}
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-slate-900">{formatPrice(item.price * item.quantity)}</p>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-between border-t border-slate-200 pt-4 text-base">
                <span className="font-bold text-slate-900">Total Amount</span>
                <span className="font-extrabold text-slate-900">{formatPrice(order.totalAmount)}</span>
              </div>
            </section>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Payment</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Payment Status</dt>
                    <dd>
                      <OrderStatusBadge value={order.paymentStatus} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Order Status</dt>
                    <dd>
                      <OrderStatusBadge value={order.status} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Payment ID</dt>
                    <dd className="mt-0.5 break-all font-mono font-semibold text-slate-900">
                      {order.razorpayPaymentId ?? "Not paid yet"}
                    </dd>
                  </div>
                  {order.razorpayRefundId && (
                    <div>
                      <dt className="text-slate-500">Refund ID</dt>
                      <dd className="mt-0.5 break-all font-mono font-semibold text-slate-900">{order.razorpayRefundId}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">Shipping Address</h2>
                <address className="mt-3 text-sm leading-relaxed text-slate-600 not-italic">
                  <span className="font-semibold text-slate-900">{address.fullName}</span>
                  <br />
                  {address.address}
                  <br />
                  {address.city}, {address.state} {address.pincode}
                  <br />
                  Phone: {address.phone}
                </address>
              </section>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
