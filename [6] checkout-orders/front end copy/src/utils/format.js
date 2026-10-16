const priceFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export const formatPrice = (value) => priceFormatter.format(value);

// Shown when a product image URL fails to load.
export const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
      '<rect width="400" height="300" fill="#f1f5f9"/>' +
      '<text x="200" y="158" font-family="sans-serif" font-size="18" fill="#94a3b8" text-anchor="middle">No image</text>' +
      "</svg>"
  );

export const handleImageError = (event) => {
  // Guard against a loop if the fallback itself ever failed.
  if (event.currentTarget.src !== FALLBACK_IMAGE) event.currentTarget.src = FALLBACK_IMAGE;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export const formatDate = (value) => dateFormatter.format(new Date(value));
