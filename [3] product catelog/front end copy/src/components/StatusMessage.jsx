// Centered message box for loading / error / empty states.
const tones = {
  neutral: "border-slate-200 bg-white text-slate-600",
  error: "border-red-200 bg-red-50 text-red-700",
};

export default function StatusMessage({ tone = "neutral", title, children }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border px-6 py-14 text-center ${tones[tone]}`}>
      <p className="text-base font-semibold">{title}</p>
      {children && <div className="mt-3 text-sm">{children}</div>}
    </div>
  );
}
