import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { getErrorMessage } from "../services/api.js";
import Navbar from "../components/Navbar.jsx";
import Alert from "../components/Alert.jsx";

const ProfileRow = ({ label, value }) => (
  <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
    <dt className="text-sm font-medium text-slate-500">{label}</dt>
    <dd className="break-all text-base font-semibold text-slate-900 sm:text-right">{value || "—"}</dd>
  </div>
);

export default function Home() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/customers/me")
      .then((res) => {
        if (!active) return;
        const data = res.data;
        setCustomer(data.customer ?? data.data ?? data);
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 401) navigate("/login", { replace: true });
        else setError(getErrorMessage(err, "Could not load your profile."));
      });
    return () => {
      active = false;
    };
  }, [navigate]);

  const initials = customer?.fullName
    ?.split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <Alert>{error}</Alert>

        {!customer && !error && (
          <div className="flex justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
          </div>
        )}

        {customer && (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 to-brand-700 p-6 text-white shadow-lg sm:p-8 lg:col-span-3">
              <p className="text-sm font-medium text-brand-100">Welcome back</p>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Hello, {customer.fullName?.split(" ")[0] || "there"}!
              </h1>
              <p className="mt-2 max-w-xl text-sm text-brand-100 sm:text-base">
                Great deals are waiting for you. Explore today&apos;s top picks on ShopKart.
              </p>
              <span className="mt-5 inline-block rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-slate-900">
                Free delivery on your first order
              </span>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                  {initials || "?"}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900">{customer.fullName}</h2>
                  <p className="text-sm text-slate-500">Your account details</p>
                </div>
              </div>

              <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
                <ProfileRow label="Full Name" value={customer.fullName} />
                <ProfileRow label="Email" value={customer.email} />
                <ProfileRow label="Phone Number" value={customer.phone} />
              </dl>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h3 className="text-base font-bold text-slate-900">Account status</h3>
              <div className="mt-4 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-slate-700">Signed in securely</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Your session is protected with an HttpOnly cookie that scripts on this page cannot read.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
