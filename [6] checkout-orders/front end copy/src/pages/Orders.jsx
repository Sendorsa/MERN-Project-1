import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import Alert from "../components/Alert.jsx";
import OrderStatusBadge from "../components/OrderStatusBadge.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { getOrders } from "../services/api.js";
import { formatDate, formatPrice } from "../utils/format.js";

export default function Orders() {
  const navigate = useNavigate();
  // Set by Checkout after a verified payment.
  const placedOrderId = useLocation().state?.placedOrderId;
  const [orders, setOrders] = useState(null); // null until the first load finishes
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    getOrders()
      .then((list) => active && setOrders(list))
      .catch((error) => {
        if (!active) return;
        if (error.response?.status === 401) navigate("/login", { replace: true });
        else setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  let content;
  if (loadError) {
    content = (
      <StatusMessage tone="error" title="Unable to load your orders.">
        Please check that the server is running and try again.
      </StatusMessage>
    );
  } else if (orders === null) {
    content = (
      <div className="py-16">
        <Spinner label="Loading your orders..." />
      </div>
    );
  } else if (orders.length === 0) {
    content = (
      <StatusMessage title="You have no orders yet 📦">
        <Link to="/products" className="font-semibold text-brand-600 hover:text-brand-700">
          Start shopping
        </Link>
      </StatusMessage>
    );
  } else {
    content = (
      <ul className="space-y-4">
        {orders.map((order) => {
          const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
          return (
            <li key={order._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500">Order ID</p>
                  <p className="break-all font-mono text-sm font-semibold text-slate-900">{order._id}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(order.createdAt)} · {units} item{units === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-lg font-extrabold text-slate-900">{formatPrice(order.totalAmount)}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Payment</dt>
                    <dd>
                      <OrderStatusBadge value={order.paymentStatus} />
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="text-slate-500">Order</dt>
                    <dd>
                      <OrderStatusBadge value={order.status} />
                    </dd>
                  </div>
                </dl>
                <Link
                  to={`/orders/${order._id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                >
                  View details
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">My Orders</h1>
        <p className="mt-1 text-sm text-slate-500">Your most recent orders appear first.</p>
      </div>

      <Alert type="success">{placedOrderId && "Payment successful! Your order has been placed."}</Alert>
      {content}
    </AppLayout>
  );
}
