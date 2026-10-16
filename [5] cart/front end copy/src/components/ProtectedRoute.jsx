import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentCustomer } from "../services/api.js";
import { fetchCart } from "../store/cartSlice.js";
import Spinner from "./Spinner.jsx";

// Checks the auth cookie with GET /customers/me before rendering.
// Wrap a page directly, or use it as a layout route: nested routes render in
// the <Outlet />, so moving between protected pages does not re-check.
// Once signed in it loads the customer's cart into the Redux store.
export default function ProtectedRoute({ children }) {
  const dispatch = useDispatch();
  const [status, setStatus] = useState("checking"); // checking | authed | guest

  useEffect(() => {
    let active = true;
    let cartRequest;
    getCurrentCustomer()
      .then(() => {
        if (!active) return;
        cartRequest = dispatch(fetchCart());
        setStatus("authed");
      })
      .catch(() => active && setStatus("guest"));
    return () => {
      active = false;
      // Leaving the signed-in area (logout): a late response must not refill the cart.
      cartRequest?.abort();
    };
  }, [dispatch]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (status === "guest") return <Navigate to="/login" replace />;

  return children ?? <Outlet />;
}
