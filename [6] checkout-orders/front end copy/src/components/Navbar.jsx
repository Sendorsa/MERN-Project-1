import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { logoutCustomer } from "../services/api.js";
import { clearCart, selectCartCount } from "../store/cartSlice.js";

const NAV_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/wishlist", label: "Wishlist" },
  { to: "/orders", label: "Orders" },
];

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-2 py-2 text-sm sm:px-3 font-semibold transition ${
    isActive ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  }`;

export default function Navbar() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const dispatch = useDispatch();
  const cartCount = useSelector(selectCartCount);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutCustomer();
    } catch {
      // Logout is idempotent on the backend; send the user to login regardless.
    } finally {
      dispatch(clearCart());
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link to="/home" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
              S
            </span>
            <span className="hidden text-xl font-extrabold tracking-tight text-slate-900 sm:inline">
              Shop<span className="text-brand-600">Kart</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              // No `end` on Products, so it stays highlighted on /products/:id.
              <NavLink key={link.to} to={link.to} end={link.to === "/home"} className={navLinkClass}>
                {link.label}
              </NavLink>
            ))}
            <NavLink to="/cart" className={navLinkClass}>
              Cart ({cartCount})
            </NavLink>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loggingOut ? "Logging out…" : "Logout"}
        </button>
      </nav>
    </header>
  );
}
