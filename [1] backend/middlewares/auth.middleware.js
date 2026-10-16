const jwt = require("jsonwebtoken");
const Customer = require("../models/customer.model");

/**
 * Route guard: reads the JWT from the HttpOnly cookie, verifies it and
 * attaches the matching customer document to req.user.
 * Responds 401 when the token is missing, invalid, expired, or the
 * customer it points at no longer exists.
 */
const protect = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Password stays excluded thanks to `select: false` on the schema.
    const customer = await Customer.findById(decoded.id);

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, customer no longer exists",
      });
    }

    req.user = customer;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token is invalid or has expired",
    });
  }
};

module.exports = protect;
