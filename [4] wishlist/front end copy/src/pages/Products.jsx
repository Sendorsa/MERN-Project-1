import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout.jsx";
import SearchBar from "../components/SearchBar.jsx";
import CategoryFilter from "../components/CategoryFilter.jsx";
import ProductCard from "../components/ProductCard.jsx";
import Spinner from "../components/Spinner.jsx";
import StatusMessage from "../components/StatusMessage.jsx";
import { getProducts } from "../services/api.js";

const SEARCH_DEBOUNCE_MS = 300;

export default function Products() {
  // Filters live in the URL (?search=&category=) so they survive a trip to a
  // product's details page and back, and a filtered view can be shared.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";

  // The input updates on every keystroke; the URL (and so the API request)
  // only after the user pauses typing.
  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  const debounceTimer = useRef(null);

  // If the URL changes from outside (e.g. the "Products" nav link clears the
  // filters), bring the input back in line with it.
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    setSearchInput(search);
  }

  // Result of the latest completed request, tagged with the filters it was
  // made for. Loading is derived: the result does not match the current filters.
  const requestKey = `${search.trim()}|${category}`;
  const [result, setResult] = useState({ key: null, products: [], error: false });
  const loading = result.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();

    getProducts({ search, category }, { signal: controller.signal })
      .then((products) => setResult({ key: requestKey, products, error: false }))
      .catch((error) => {
        // A newer request replaced this one; ignore the cancellation.
        if (error.code === "ERR_CANCELED") return;
        setResult({ key: requestKey, products: [], error: true });
      });

    // Cancel an in-flight request when filters change, so a slow, stale
    // response can never overwrite the results of a newer search.
    return () => controller.abort();
  }, [search, category, requestKey]);

  useEffect(() => () => clearTimeout(debounceTimer.current), []);

  const updateParam = (key, value) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value.trim()) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const handleSearchChange = (value) => {
    setSearchInput(value);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSyncedSearch(value);
      updateParam("search", value);
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleCategoryChange = (value) => updateParam("category", value);

  const clearFilters = () => {
    clearTimeout(debounceTimer.current);
    setSearchInput("");
    setSyncedSearch("");
    setSearchParams({}, { replace: true });
  };

  const hasFilters = Boolean(search.trim() || category);

  let content;
  if (loading) {
    content = (
      <div className="py-16">
        <Spinner label="Loading products..." />
      </div>
    );
  } else if (result.error) {
    content = (
      <StatusMessage tone="error" title="Something went wrong while loading products.">
        Please check that the server is running and try again.
      </StatusMessage>
    );
  } else if (result.products.length === 0) {
    content = (
      <StatusMessage title="No products found.">
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="font-semibold text-brand-600 hover:text-brand-700">
            Clear filters
          </button>
        )}
      </StatusMessage>
    );
  } else {
    content = (
      <>
        <p className="mb-4 text-sm text-slate-500">
          Showing {result.products.length} product{result.products.length === 1 ? "" : "s"}
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      </>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Products</h1>
        <p className="mt-1 text-sm text-slate-500">Discover our latest collection across every category.</p>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <SearchBar value={searchInput} onChange={handleSearchChange} />
        <CategoryFilter value={category} onChange={handleCategoryChange} />
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="shrink-0 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {content}
    </AppLayout>
  );
}
