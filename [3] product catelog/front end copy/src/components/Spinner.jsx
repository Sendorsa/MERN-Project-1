export default function Spinner({ label }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
      {label && <p className="text-sm font-medium text-slate-500">{label}</p>}
    </div>
  );
}
