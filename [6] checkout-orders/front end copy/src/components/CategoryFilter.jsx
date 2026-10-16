import { CATEGORY_OPTIONS } from "../constants/categories.js";

export default function CategoryFilter({ value, onChange }) {
  return (
    <select
      aria-label="Filter by category"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none sm:w-56"
    >
      {CATEGORY_OPTIONS.map((option) => (
        <option key={option.value || "all"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
