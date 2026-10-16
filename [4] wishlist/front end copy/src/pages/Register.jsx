import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getErrorMessage, registerCustomer } from "../services/api.js";
import AuthLayout from "../components/AuthLayout.jsx";
import FormField from "../components/FormField.jsx";
import Alert from "../components/Alert.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

// Mirrors the backend's rules so most mistakes are caught before a request.
const validate = ({ fullName, email, password, phone }) => {
  const errors = {};
  if (!fullName.trim()) errors.fullName = "Full name is required.";
  if (!email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
  if (!password) errors.password = "Password is required.";
  else if (password.length < 6) errors.password = "Password must be at least 6 characters.";
  if (!phone.trim()) errors.phone = "Phone number is required.";
  else if (!PHONE_RE.test(phone.trim())) errors.phone = "Phone must be 10-15 digits, optionally starting with +.";
  return errors;
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", password: "", phone: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError("");

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await registerCustomer({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
      });
      navigate("/login", {
        replace: true,
        state: { registered: true, email: form.email.trim() },
      });
    } catch (error) {
      setServerError(getErrorMessage(error, "Registration failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join ShopKart and start shopping in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <Alert>{serverError}</Alert>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <FormField
          label="Full Name"
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder="Athish R"
          value={form.fullName}
          onChange={handleChange}
          error={errors.fullName}
        />
        <FormField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
        />
        <FormField
          label="Phone Number"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="9876543210"
          value={form.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-brand-600/20 transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
