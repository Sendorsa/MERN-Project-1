import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api.js";

// Checks the auth cookie with GET /customers/me before rendering children.
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | authed | guest

  useEffect(() => {
    let active = true;
    api
      .get("/customers/me")
      .then(() => active && setStatus("authed"))
      .catch(() => active && setStatus("guest"));
    return () => {
      active = false;
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
      </div>
    );
  }

  if (status === "guest") return <Navigate to="/login" replace />;

  return children;
}
