// Controlled search input. The parent owns the value and decides when to fetch.
export default function SearchBar({ value, onChange, placeholder = "Search products..." }) {
  return (
    <div className="relative w-full">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400"
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        type="search"
        aria-label="Search products by name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-11 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
      />
    </div>
  );
}
