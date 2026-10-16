import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getCurrentCustomer } from "../services/api.js";
import Spinner from "./Spinner.jsx";

// Checks the auth cookie with GET /customers/me before rendering.
// Wrap a page directly, or use it as a layout route: nested routes render in
// the <Outlet />, so moving between protected pages does not re-check.
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | authed | guest

  useEffect(() => {
    let active = true;
    getCurrentCustomer()
      .then(() => active && setStatus("authed"))
      .catch(() => active && setStatus("guest"));
    return () => {
      active = false;
    };
  }, []);

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
