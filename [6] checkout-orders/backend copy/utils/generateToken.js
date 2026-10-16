const jwt = require("jsonwebtoken");

const DEFAULT_EXPIRY = "7d";

/**
 * Signs a JWT whose payload carries the customer id.
 * Reads JWT_SECRET at call time (not at module load) so the value is always
 * the one dotenv actually loaded, regardless of require order.
 *
 * @param {string} customerId - Mongo ObjectId of the customer.
 * @returns {string} Signed JWT.
 */
const generateToken = (customerId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment");
  }

  return jwt.sign({ id: customerId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY,
  });
};

/**
 * Returns a token's exact lifetime in milliseconds, read from its own `iat`
 * and `exp` claims. Deriving it from the signed token rather than re-parsing
 * JWT_EXPIRES_IN guarantees the auth cookie and the JWT inside it expire at
 * the same instant, whatever the configured expiry string is.
 *
 * @param {string} token - A signed JWT.
 * @returns {number} Lifetime in milliseconds.
 */
const getTokenExpiryMs = (token) => {
  const decoded = jwt.decode(token);

  if (!decoded || typeof decoded.exp !== "number" || typeof decoded.iat !== "number") {
    throw new Error("Unable to read expiry claims from the generated token");
  }

  return (decoded.exp - decoded.iat) * 1000;
};

module.exports = { generateToken, getTokenExpiryMs };
