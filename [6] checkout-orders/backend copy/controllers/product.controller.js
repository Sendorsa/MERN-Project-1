const Product = require("../models/product.model");

const REQUIRED_FIELDS = ["name", "description", "price", "category", "image", "stock"];
const TEXT_FIELDS = ["name", "description", "category", "image"];
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const IMAGE_URL_PATTERN = /^https?:\/\/\S+$/i;

/**
 * Escapes RegExp metacharacters so user input is always matched literally.
 * Without this, a search such as "(" throws, and ".*" matches everything.
 */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isMissing = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

/**
 * Validates a create-product payload.
 *
 * Text fields must be strings (so `{"name": {"$ne": null}}` is rejected as a
 * client error), price must be a number > 0, and stock a whole number >= 0.
 *
 * @param {object} body - Usually req.body.
 * @returns {string|null} Error message, or null when the payload is valid.
 */
const validateProductInput = (body) => {
  const missing = REQUIRED_FIELDS.filter((field) => isMissing(body[field]));

  if (missing.length > 0) {
    return `The following fields are required: ${missing.join(", ")}`;
  }

  const nonText = TEXT_FIELDS.filter((field) => typeof body[field] !== "string");

  if (nonText.length > 0) {
    return `The following fields must be text: ${nonText.join(", ")}`;
  }

  if (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0) {
    return "Price must be a number greater than 0";
  }

  if (typeof body.stock !== "number" || !Number.isInteger(body.stock) || body.stock < 0) {
    return "Stock must be a whole number greater than or equal to 0";
  }

  if (!IMAGE_URL_PATTERN.test(body.image.trim())) {
    return "Image must be a valid http(s) URL";
  }

  return null;
};

/**
 * @desc    Create a product
 * @route   POST /products
 * @access  Public
 */
const createProduct = async (req, res, next) => {
  try {
    const body = req.body || {};

    const validationError = validateProductInput(body);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Whitelist the fields - never pass req.body straight to the model.
    const { name, description, price, category, image, stock } = body;

    const product = await Product.create({ name, description, price, category, image, stock });

    return res.status(201).json({ success: true, product });
  } catch (error) {
    // Mongoose schema validation (e.g. max length)
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((field) => field.message)
        .join(", ");

      return res.status(400).json({ success: false, message });
    }

    return next(error);
  }
};

/**
 * @desc    List products, optionally filtered by name search and/or category
 * @route   GET /products?search=keyboard&category=Electronics
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const { search, category } = req.query;

    // ?search=a&search=b arrives as an array - reject anything but a string.
    if ((search !== undefined && typeof search !== "string") ||
        (category !== undefined && typeof category !== "string")) {
      return res.status(400).json({
        success: false,
        message: "search and category must each be a single text value",
      });
    }

    // Build the filter dynamically: each parameter adds one condition, so
    // one endpoint serves no filter, search only, category only, or both.
    const filter = {};

    if (search && search.trim()) {
      // Case-insensitive partial match on the product name.
      filter.name = { $regex: escapeRegex(search.trim()), $options: "i" };
    }

    if (category && category.trim()) {
      // Exact category, ignoring case ("electronics" == "Electronics").
      filter.category = { $regex: `^${escapeRegex(category.trim())}$`, $options: "i" };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get a single product by id
 * @route   GET /products/:id
 * @access  Public
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Checked up front so a malformed id is a 400, not a Mongoose CastError.
    if (!OBJECT_ID_PATTERN.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid product id" });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    return res.status(200).json({ success: true, product });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
};
