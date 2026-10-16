const Razorpay = require("razorpay");

let instance = null;

/**
 * Returns the shared Razorpay client, created on first use from .env.
 * Created lazily so the rest of the API still starts when payment keys are
 * missing; only the payment endpoints fail, with a clear message.
 * Only test-mode keys (rzp_test_...) are accepted in this project.
 *
 * @returns {Razorpay}
 */
const getRazorpay = () => {
  if (instance) return instance;

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set in .env");
  }
  if (!RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    throw new Error("Only Razorpay test-mode keys (rzp_test_...) are allowed");
  }

  instance = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return instance;
};

module.exports = getRazorpay;
