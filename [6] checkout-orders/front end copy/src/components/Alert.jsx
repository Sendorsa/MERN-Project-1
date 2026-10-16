const styles = {
  error: "border-red-200 bg-red-50 text-red-700",
  success: "border-green-200 bg-green-50 text-green-700",
};

export default function Alert({ type = "error", children }) {
  if (!children) return null;
  return (
    <div role="alert" className={`mb-5 rounded-lg border px-4 py-3 text-sm font-medium ${styles[type]}`}>
      {children}
    </div>
  );
}
