const crypto = require("crypto");
const mongoose = require("mongoose");

const Customer = require("../models/customer.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const getRazorpay = require("../config/razorpay");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const PHONE_PATTERN = /^\+?\d{10,15}$/;
const PINCODE_PATTERN = /^\d{6}$/;
const ADDRESS_FIELDS = ["fullName", "phone", "address", "city", "state", "pincode"];
const MAX_FIELD_LENGTH = 200;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Validates the shipping address from the request body.
 * @returns {{ error: string } | { address: object }}
 */
const parseShippingAddress = (input) => {
  if (!input || typeof input !== "object") return { error: "Shipping address is required" };

  const address = {};
  const missing = [];

  for (const field of ADDRESS_FIELDS) {
    const value = input[field];
    // Strings only, so `{ "city": { "$ne": null } }` is rejected outright.
    if (typeof value !== "string" || !value.trim()) missing.push(field);
    else address[field] = value.trim();
  }

  if (missing.length) return { error: `The following address fields are required: ${missing.join(", ")}` };
  if (ADDRESS_FIELDS.some((field) => address[field].length > MAX_FIELD_LENGTH)) {
    return { error: `Address fields must not exceed ${MAX_FIELD_LENGTH} characters` };
  }
  if (!PHONE_PATTERN.test(address.phone)) {
    return { error: "Phone number must be 10 to 15 digits, optionally prefixed with +" };
  }
  if (!PINCODE_PATTERN.test(address.pincode)) return { error: "Pincode must be 6 digits" };

  return { address };
};

/** Constant-time comparison of two hex strings. */
const signaturesMatch = (expected, received) => {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * @desc    Turn the cart into a PENDING order and open a Razorpay order for it
 * @route   POST /orders/create-payment-order   body: { shippingAddress }
 * @access  Private
 *
 * The cart is NOT cleared here: the customer has not paid yet.
 */
const createPaymentOrder = async (req, res, next) => {
  try {
    const parsed = parseShippingAddress(req.body && req.body.shippingAddress);
    if (parsed.error) return fail(res, 400, parsed.error);

    // Prices and stock come from the database, never from the client.
    const customer = await Customer.findById(req.user._id).populate("cart.product");
    const cart = customer ? customer.cart.filter((item) => item.product) : [];

    if (cart.length === 0) return fail(res, 400, "Your cart is empty");

    const shortItem = cart.find((item) => item.quantity > item.product.stock);
    if (shortItem) {
      return fail(res, 400, `Only ${shortItem.product.stock} of ${shortItem.product.name} in stock`);
    }

    const items = cart.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price,
    }));
    // Round to paise to avoid floating point drift (0.1 + 0.2).
    const totalAmount = Math.round(items.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;

    let razorpay;
    try {
      razorpay = getRazorpay();
    } catch (configError) {
      console.error("[payments]", configError.message);
      return fail(res, 503, "Payments are not configured on the server");
    }

    const order = await Order.create({
      user: req.user._id,
      items,
      shippingAddress: parsed.address,
      totalAmount,
    });

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: Math.round(totalAmount * 100), // paise
        currency: "INR",
        receipt: order._id.toString(),
      });
    } catch (razorpayError) {
      // No Razorpay order means nothing can ever be paid against this one.
      await Order.deleteOne({ _id: order._id });
      console.error("[payments] Razorpay order failed:", razorpayError.error || razorpayError.message);
      return fail(res, 502, "Could not start the payment. Please try again.");
    }

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(201).json({
      success: true,
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    return next(error);
  }
};

// --- Inventory ----------------------------------------------------------

/** Raised when a verified payment's order can no longer be fulfilled. */
class StockError extends Error {}

let transactionSupport = null;

/**
 * Transactions need a replica set or sharded cluster (Atlas always is).
 * A standalone local mongod is not, so it is checked once at runtime.
 */
const supportsTransactions = () => {
  // MONGODB_TRANSACTIONS=off forces the non-transaction path (used by tests).
  if (process.env.MONGODB_TRANSACTIONS === "off") return Promise.resolve(false);
  transactionSupport ??= mongoose.connection.db
    .admin()
    .command({ hello: 1 })
    .then((hello) => Boolean(hello.setName || hello.msg === "isdbgrid"))
    .catch(() => false);
  return transactionSupport;
};

/** Total quantity per product, in case an order lists a product twice. */
const quantitiesByProduct = (items) => {
  const totals = new Map();
  for (const item of items) {
    const id = String(item.product);
    totals.set(id, (totals.get(id) || 0) + item.quantity);
  }
  return totals;
};

/**
 * Deducts every item of the order from stock, all or nothing.
 *
 * Each update only matches while `stock >= quantity`, so stock can never go
 * negative and two buyers can never both take the last unit: MongoDB applies
 * the check and the decrement as one atomic operation per product.
 *
 * Inside a transaction a failure rolls everything back. Without one, the
 * deductions already applied are put back before throwing.
 *
 * @throws {StockError}
 */
const deductStock = async (items, session) => {
  const applied = [];

  for (const [productId, quantity] of quantitiesByProduct(items)) {
    const result = await Product.updateOne(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { session }
    );

    if (result.modifiedCount !== 1) {
      if (!session) {
        await Promise.all(applied.map(([id, qty]) => Product.updateOne({ _id: id }, { $inc: { stock: qty } })));
      }
      const product = await Product.findById(productId, "name").session(session ?? null);
      throw new StockError(
        product
          ? `Sorry, ${product.name} went out of stock before your payment completed.`
          : "Sorry, a product in your order is no longer available."
      );
    }
    applied.push([productId, quantity]);
  }
};

/**
 * Settles a verified payment: claims the order, deducts stock, marks it
 * PLACED and clears the cart, as one transaction when available.
 *
 * The claim matches only `paymentStatus: "PENDING"`, so of any number of
 * concurrent or repeated verifications exactly one gets past it; the others
 * receive null and report the stored outcome instead. That is what makes
 * stock deduction happen at most once per order.
 *
 * @returns {Promise<object|null>} The placed order, or null if another request settled it.
 * @throws {StockError} When stock ran out; nothing has been changed in that case.
 */
const fulfilOrder = async (orderId, paymentId) => {
  const run = async (session) => {
    const claimed = await Order.findOneAndUpdate(
      { _id: orderId, paymentStatus: "PENDING" },
      { $set: { paymentStatus: "PAID", razorpayPaymentId: paymentId } },
      { new: true, session }
    );
    if (!claimed) return null;

    try {
      await deductStock(claimed.items, session);
    } catch (error) {
      // Without a transaction, release the claim so the order can be cancelled.
      if (!session) await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: "PENDING" } });
      throw error;
    }

    claimed.status = "PLACED";
    await claimed.save({ session });
    // Only now, after a verified payment and successful stock deduction.
    await Customer.updateOne({ _id: claimed.user }, { $set: { cart: [] } }, { session });
    return claimed;
  };

  if (await supportsTransactions()) {
    // Retries automatically on write conflicts between concurrent buyers;
    // a StockError aborts the transaction and rolls every write back.
    return mongoose.connection.transaction((session) => run(session));
  }

  // ponytail: no transactions on a standalone mongod. Each step is atomic and
  // a stock failure is compensated, but a crash between steps can leave an
  // order PAID/PENDING with stock deducted; run a replica set to avoid that.
  return run();
};

/**
 * Payment succeeded but the order cannot be fulfilled: never leave the
 * customer charged for nothing. Marks the order CANCELLED (once, even under
 * concurrent requests) and refunds the payment through Razorpay.
 *
 * @returns {Promise<object|null>} The cancelled order, or null if another request settled it.
 */
const cancelAndRefund = async (orderId, paymentId, reason) => {
  const cancelled = await Order.findOneAndUpdate(
    { _id: orderId, status: "PENDING" },
    { $set: { paymentStatus: "PAID", status: "CANCELLED", razorpayPaymentId: paymentId, failureReason: reason } },
    { new: true }
  );
  if (!cancelled) return null;

  try {
    const refund = await getRazorpay().payments.refund(paymentId, {});
    cancelled.paymentStatus = "REFUNDED";
    cancelled.razorpayRefundId = refund.id;
    await cancelled.save();
  } catch (error) {
    // Stays PAID + CANCELLED, which is the signal for a manual refund.
    const detail = (error.error && error.error.description) || error.message;
    console.error(`[payments] Automatic refund failed for order ${orderId}: ${detail}`);
  }
  return cancelled;
};

/** Sends the stored outcome of a verified payment. */
const sendOutcome = (res, order) => {
  if (order.status === "PLACED") {
    return res.status(200).json({ success: true, message: "Payment verified. Order placed.", order });
  }
  if (order.status === "CANCELLED") {
    const refundNote =
      order.paymentStatus === "REFUNDED"
        ? "Your payment has been refunded."
        : "Your payment will be refunded. Please contact support if you need help.";
    return res.status(409).json({ success: false, message: `${order.failureReason} ${refundNote}`, order });
  }
  // PAID but not yet PLACED: another request is still processing it.
  return res.status(409).json({ success: false, message: "Your payment is still being processed. Please check your orders shortly.", order });
};

/**
 * @desc    Verify the Razorpay signature, then deduct stock, place the order
 *          and clear the cart. Safe to call repeatedly for the same payment.
 * @route   POST /orders/verify-payment
 *          body: { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * @access  Private
 *
 * 200  order placed (also for a repeat of an already placed payment)
 * 400  invalid input, signature mismatch, or a different payment for a settled order
 * 409  paid, but stock ran out: order cancelled and refunded
 */
const verifyPayment = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { orderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId } = body;
    const signature = body.razorpay_signature;

    if ([orderId, razorpayOrderId, paymentId, signature].some((value) => typeof value !== "string" || !value)) {
      return fail(res, 400, "orderId, razorpay_order_id, razorpay_payment_id and razorpay_signature are required");
    }
    if (!OBJECT_ID_PATTERN.test(orderId)) return fail(res, 400, "Invalid order id");

    // Scoped to the signed-in user: nobody can settle someone else's order.
    const order = await Order.findOne({ _id: orderId, user: req.user._id });
    if (!order) return fail(res, 404, "Order not found");

    // The signature must be for THIS order's Razorpay order, not any order.
    if (razorpayOrderId !== order.razorpayOrderId) return fail(res, 400, "Payment does not match this order");

    // Razorpay signs "<razorpay_order_id>|<razorpay_payment_id>" with the key secret.
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(`${order.razorpayOrderId}|${paymentId}`)
      .digest("hex");

    if (!process.env.RAZORPAY_KEY_SECRET || !signaturesMatch(expected, signature)) {
      return fail(res, 400, "Payment verification failed");
    }

    // Already settled: report the stored outcome, never process it again.
    if (order.paymentStatus !== "PENDING" || order.status !== "PENDING") {
      if (order.razorpayPaymentId !== paymentId) return fail(res, 400, "Order is already paid");
      return sendOutcome(res, order);
    }

    // Quantities and products come from the stored order, never the request.
    let settled;
    try {
      settled = await fulfilOrder(order._id, paymentId);
    } catch (error) {
      if (!(error instanceof StockError)) throw error;
      settled = await cancelAndRefund(order._id, paymentId, error.message);
    }

    // null: a concurrent request settled it first; report what it stored.
    return sendOutcome(res, settled ?? (await Order.findById(order._id)));
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    List the signed-in customer's orders, newest first
 * @route   GET /orders
 * @access  Private
 */
const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    One order with product details
 * @route   GET /orders/:id
 * @access  Private (own orders only)
 */
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!OBJECT_ID_PATTERN.test(id)) return fail(res, 400, "Invalid order id");

    // Someone else's order answers 404, same as a missing one, so order ids
    // cannot be probed.
    const order = await Order.findOne({ _id: id, user: req.user._id }).populate("items.product", "name image");
    if (!order) return fail(res, 404, "Order not found");

    return res.status(200).json({ success: true, order });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
};
