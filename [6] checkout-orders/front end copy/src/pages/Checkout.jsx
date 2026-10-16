import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import Alert from "../components/Alert.jsx";
import FormField from "../components/FormField.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { createPaymentOrder, getErrorMessage, verifyPayment } from "../services/api.js";
import { clearCart, fetchCart, selectCartError, selectCartItems, selectCartLoading } from "../store/cartSlice.js";
import { formatPrice } from "../utils/format.js";

const RAZORPAY_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const PHONE_RE = /^\+?\d{10,15}$/;
const PINCODE_RE = /^\d{6}$/;

const FIELDS = [
  { name: "fullName", label: "Full Name", autoComplete: "name", placeholder: "Athish R" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel", placeholder: "9876543210" },
  { name: "address", label: "Address", autoComplete: "street-address", placeholder: "House no, street, area" },
  { name: "city", label: "City", autoComplete: "address-level2", placeholder: "Bengaluru" },
  { name: "state", label: "State", autoComplete: "address-level1", placeholder: "Karnataka" },
  { name: "pincode", label: "Pincode", inputMode: "numeric", autoComplete: "postal-code", placeholder: "560001" },
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map((field) => [field.name, ""]));

// Mirrors the backend's rules so most mistakes are caught before a request.
const validate = (form) => {
  const errors = {};
  for (const { name, label } of FIELDS) {
    if (!form[name].trim()) errors[name] = `${label} is required.`;
  }
  if (!errors.phone && !PHONE_RE.test(form.phone.trim())) {
    errors.phone = "Phone must be 10-15 digits, optionally starting with +.";
  }
  if (!errors.pincode && !PINCODE_RE.test(form.pincode.trim())) errors.pincode = "Pincode must be 6 digits.";
  return errors;
};

// Loads Razorpay's official checkout.js once and resolves to window.Razorpay.
let razorpayLoader = null;
const loadRazorpay = () => {
  razorpayLoader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SRC;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      razorpayLoader = null; // allow a retry
      script.remove();
      reject(new Error("Razorpay failed to load"));
    };
    document.body.appendChild(script);
  });
  return razorpayLoader;
};

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const items = useSelector(selectCartItems);
  const loading = useSelector(selectCartLoading);
  const loadError = useSelector(selectCartError);

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [paying, setPaying] = useState(false);

  // Start downloading checkout.js early so the popup opens without delay.
  useEffect(() => {
    loadRazorpay().catch(() => {});
  }, []);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setServerError("");
    setNotice("");

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    const shippingAddress = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]));

    setPaying(true);
    let Razorpay;
    let payment;
    try {
      // Script first: if it is blocked, no PENDING order is created for nothing.
      Razorpay = await loadRazorpay();
      payment = await createPaymentOrder(shippingAddress);
    } catch (error) {
      setServerError(
        error.message === "Razorpay failed to load"
          ? "Could not load the payment window. Check your connection and try again."
          : getErrorMessage(error, "Could not start the payment. Please try again.")
      );
      setPaying(false);
      return;
    }

    const checkout = new Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.razorpayOrderId,
      name: "ShopKart",
      description: `Order ${payment.orderId}`,
      prefill: { name: shippingAddress.fullName, contact: shippingAddress.phone },
      theme: { color: "#1f55e6" },
      // Called by Razorpay after a successful payment. The backend checks the
      // signature and deducts stock; only then is the order PLACED and the
      // cart cleared. Stock is never changed here.
      handler: async (response) => {
        try {
          await verifyPayment({ orderId: payment.orderId, ...response });
          dispatch(clearCart()); // the backend already emptied the saved cart
          navigate("/orders", { replace: true, state: { placedOrderId: payment.orderId } });
        } catch (error) {
          // 409: paid, but an item sold out meanwhile, so the backend cancelled
          // and refunded the order. Its message says so.
          setServerError(
            getErrorMessage(
              error,
              "We could not verify your payment. If money was deducted, contact support with your payment ID."
            )
          );
          setPaying(false);
          dispatch(fetchCart()); // show the latest stock
        }
      },
      modal: {
        ondismiss: () => {
          setPaying(false);
          setNotice("Payment cancelled. Your cart has not been changed.");
        },
      },
    });
    // The popup stays open after a failure so the customer can retry.
    checkout.on("payment.failed", (response) => {
      setServerError(`Payment failed: ${response.error.description}`);
    });
    checkout.open();
  };

  let content;
  if (loading && items.length === 0) {
    content = (
      <div className="py-16">
        <Spinner label="Loading your cart..." />
      </div>
    );
  } else if (loadError) {
    content = <StatusMessage tone="error" title="Unable to load your cart." />;
  } else if (items.length === 0) {
    content = (
      <StatusMessage title="Your cart is empty 🛒">
        Add something to your cart before checking out.{" "}
        <Link to="/products" className="font-semibold text-brand-600 hover:text-brand-700">
          Browse products
        </Link>
      </StatusMessage>
    );
  } else {
    content = (
      <form onSubmit={handlePay} noValidate className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-900">Shipping Address</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ name, label, ...inputProps }) => (
              <div key={name} className={name === "address" ? "sm:col-span-2" : undefined}>
                <FormField
                  label={label}
                  name={name}
                  type="text"
                  value={form[name]}
                  onChange={handleChange}
                  error={errors[name]}
                  disabled={paying}
                  {...inputProps}
                />
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {items.map(({ product, quantity }) => (
              <li key={product._id} className="flex justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold text-slate-900">{product.name}</p>
                  <p className="mt-0.5 text-slate-500">
                    {quantity} × {formatPrice(product.price)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-slate-900">{formatPrice(product.price * quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-4 text-base">
            <span className="font-bold text-slate-900">Total</span>
            <span className="font-extrabold text-slate-900">{formatPrice(total)}</span>
          </div>
          <button
            type="submit"
            disabled={paying}
            className="mt-5 w-full rounded-lg bg-accent-400 px-6 py-3 text-base font-bold text-slate-900 shadow-md shadow-amber-500/20 transition hover:brightness-95 focus:ring-4 focus:ring-amber-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {paying ? "Processing…" : `Pay Now ${formatPrice(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">Secure payment via Razorpay (test mode)</p>
        </aside>
      </form>
    );
  }

  return (
    <AppLayout>
      <Link
        to="/cart"
        className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
      >
        <span aria-hidden="true">&larr;</span> Back to cart
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Checkout</h1>
        <p className="mt-1 text-sm text-slate-500">Enter your shipping details and pay securely.</p>
      </div>

      <Alert>{serverError}</Alert>
      <Alert type="success">{notice}</Alert>
      {content}
    </AppLayout>
  );
}
