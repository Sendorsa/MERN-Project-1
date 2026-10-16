const Customer = require("../models/customer.model");
const { generateToken, getTokenExpiryMs } = require("../utils/generateToken");

const MIN_PASSWORD_LENGTH = 6;

/**
 * Builds the options for the HttpOnly authentication cookie.
 *
 * This is a function, not a module level constant, so `NODE_ENV` is read on
 * every request instead of once at require time - a module level constant
 * would silently resolve to `secure: false` if the require order ever changed
 * so that this file loaded before dotenv ran.
 *
 * @param {number} [maxAge] - Cookie lifetime in ms. Omitted when clearing,
 *   so that the clearing flags match the flags the cookie was set with.
 * @returns {object} Cookie options.
 */
const buildCookieOptions = (maxAge) => {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  };

  if (typeof maxAge === "number") {
    options.maxAge = maxAge;
  }

  return options;
};

/**
 * Shapes a customer document into the public payload returned by the API.
 * An explicit whitelist - the password can never be added by accident.
 */
const toPublicCustomer = (customer) => ({
  _id: customer._id,
  fullName: customer.fullName,
  email: customer.email,
  phone: customer.phone,
  createdAt: customer.createdAt,
  updatedAt: customer.updatedAt,
});

/**
 * Validates that every named field is present AND is a non-empty string.
 *
 * The string check is what stops a JSON body such as `{"email": {"$ne": null}}`
 * from reaching `email.toLowerCase()` or a Mongo query - a malformed payload
 * is a client error (400), never a server error (500).
 *
 * @param {object} source - Usually req.body.
 * @param {string[]} fields - Field names that must be non-empty strings.
 * @returns {string|null} Error message, or null when every field is valid.
 */
const validateStringFields = (source, fields) => {
  const missing = fields.filter((field) => {
    const value = source[field];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length === 0) return null;

  return `The following fields are required and must be non-empty text: ${missing.join(", ")}`;
};

/**
 * @desc    Register a new customer
 * @route   POST /customers/register
 * @access  Public
 */
const registerCustomer = async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body || {};

    // --- Validation -------------------------------------------------
    const validationError = validateStringFields(req.body || {}, [
      "fullName",
      "email",
      "password",
      "phone",
    ]);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      });
    }

    const normalisedEmail = email.toLowerCase().trim();

    // --- Uniqueness -------------------------------------------------
    const existingCustomer = await Customer.findOne({ email: normalisedEmail });

    if (existingCustomer) {
      return res.status(409).json({
        success: false,
        message: "A customer with this email already exists",
      });
    }

    // Password is hashed by the pre-save hook on the model.
    const customer = await Customer.create({
      fullName,
      email: normalisedEmail,
      password,
      phone,
    });

    return res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      customer: toPublicCustomer(customer),
    });
  } catch (error) {
    // Mongoose schema validation (min length, email format, phone format)
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((field) => field.message)
        .join(", ");

      return res.status(400).json({ success: false, message });
    }

    // Unique index race: two requests for the same email at once
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A customer with this email already exists",
      });
    }

    return next(error);
  }
};

/**
 * @desc    Authenticate a customer and issue a JWT cookie
 * @route   POST /customers/login
 * @access  Public
 */
const loginCustomer = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    const validationError = validateStringFields(req.body || {}, [
      "email",
      "password",
    ]);

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    // Password is `select: false` on the schema, so ask for it explicitly.
    const customer = await Customer.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");

    // Same message for unknown email and wrong password - do not leak
    // which accounts exist.
    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await customer.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Cookie lifetime is read from the token's own claims, so the cookie and
    // the JWT inside it always expire together.
    const token = generateToken(customer._id);
    res.cookie("token", token, buildCookieOptions(getTokenExpiryMs(token)));

    return res.status(200).json({
      success: true,
      message: "Login successful",
      customer: toPublicCustomer(customer),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Return the authenticated customer's profile
 * @route   GET /customers/me
 * @access  Private (requires auth middleware)
 */
const getMyProfile = async (req, res, next) => {
  try {
    // req.user is attached by the auth middleware, already without password.
    return res.status(200).json({
      success: true,
      customer: toPublicCustomer(req.user),
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Clear the authentication cookie
 * @route   POST /customers/logout
 * @access  Public - deliberately unauthenticated.
 *
 * Logout is idempotent. Putting it behind the auth middleware would mean a
 * customer holding an expired token gets a 401 and keeps the stale cookie
 * forever, which is the exact situation logout exists to resolve.
 */
const logoutCustomer = async (req, res, next) => {
  try {
    // Clearing must use the same flags the cookie was set with.
    res.clearCookie("token", buildCookieOptions());

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerCustomer,
  loginCustomer,
  getMyProfile,
  logoutCustomer,
};
