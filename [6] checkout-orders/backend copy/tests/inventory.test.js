/**
 * Stock deduction after payment verification.
 *   npm test
 *
 * Runs the real controllers in-process against a separate `shopkart_test`
 * database on the configured cluster (your real catalog is never touched).
 * Razorpay is replaced with a fake, so no network calls or payments happen;
 * signatures are computed exactly the way Razorpay computes them.
 */
const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const path = require("path");

// Test-only keys, set before dotenv so the real ones in .env are never used.
process.env.RAZORPAY_KEY_ID = "rzp_test_inventory_suite";
process.env.RAZORPAY_KEY_SECRET = "inventory_suite_secret";
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

// --- Fake Razorpay ------------------------------------------------------
const razorpay = {
  orderCount: 0,
  refunds: [],
  refundShouldFail: false,
  orders: {
    create: async ({ amount, currency }) => ({ id: `order_fake${++razorpay.orderCount}`, amount, currency }),
  },
  payments: {
    refund: async (paymentId) => {
      if (razorpay.refundShouldFail) throw new Error("refund rejected by fake Razorpay");
      razorpay.refunds.push(paymentId);
      return { id: `rfnd_fake${razorpay.refunds.length}` };
    },
  },
};
const razorpayPath = require.resolve("../config/razorpay");
require.cache[razorpayPath] = { id: razorpayPath, filename: razorpayPath, loaded: true, exports: () => razorpay };

const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const { createPaymentOrder, verifyPayment } = require("../controllers/order.controller");

const TEST_DB = "shopkart_test";
const ADDRESS = {
  fullName: "Inventory Tester",
  phone: "9876543210",
  address: "1 Test Lane",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

// --- Helpers ------------------------------------------------------------
let seq = 0;

/** Calls an Express handler with a fake req/res and returns { status, body }. */
const call = async (handler, req) => {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  let thrown;
  await handler({ params: {}, body: {}, ...req }, res, (error) => {
    thrown = error;
  });
  if (thrown) throw thrown;
  return { status: res.statusCode, body: res.body };
};

const makeProduct = (stock) =>
  Product.create({
    name: `Test Product ${++seq}`,
    description: "Inventory test product",
    price: 100,
    category: "Test",
    image: "https://example.com/test.png",
    stock,
  });

const makeCustomer = (cart) =>
  Customer.create({
    fullName: "Inventory Tester",
    email: `inventory${++seq}-${Date.now()}@test.com`,
    password: "secret123",
    phone: "9876543210",
    cart: cart.map(([product, quantity]) => ({ product: product._id, quantity })),
  });

/** POST /orders/create-payment-order for the customer's current cart. */
const checkout = (customer) => call(createPaymentOrder, { user: customer, body: { shippingAddress: ADDRESS } });

/** POST /orders/verify-payment with a signature Razorpay would produce. */
const pay = (customer, created, { paymentId = `pay_fake${++seq}`, signature } = {}) => {
  const { orderId, razorpayOrderId } = created.body;
  const valid = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");
  return call(verifyPayment, {
    user: customer,
    body: {
      orderId: String(orderId),
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature ?? valid,
    },
  });
};

const stockOf = async (product) => (await Product.findById(product._id)).stock;
const orderOf = (created) => Order.findById(created.body.orderId);
const cartOf = async (customer) => (await Customer.findById(customer._id)).cart.length;

// --- Suite --------------------------------------------------------------
before(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: TEST_DB });
  assert.equal(mongoose.connection.name, TEST_DB, "refusing to run outside the test database");
  await Promise.all([Customer.init(), Order.init(), Product.init()]);
});

beforeEach(async () => {
  razorpay.refunds = [];
  razorpay.refundShouldFail = false;
  await Promise.all([Customer.deleteMany({}), Order.deleteMany({}), Product.deleteMany({})]);
});

after(async () => {
  // Emptied rather than dropped: Atlas users often lack dropDatabase.
  try {
    if (mongoose.connection.name === TEST_DB) {
      await Promise.all([Customer.deleteMany({}), Order.deleteMany({}), Product.deleteMany({})]);
    }
  } finally {
    await mongoose.disconnect();
  }
});

describe("stock deduction after payment verification", () => {
  test("A: successful purchase deducts stock (10 - 2 = 8) and places the order", async () => {
    const product = await makeProduct(10);
    const customer = await makeCustomer([[product, 2]]);

    const created = await checkout(customer);
    assert.equal(created.status, 201);
    assert.equal(await stockOf(product), 10, "opening checkout must not touch stock");
    assert.equal(await cartOf(customer), 1, "cart is kept until payment is verified");

    const verified = await pay(customer, created);
    assert.equal(verified.status, 200);
    assert.equal(await stockOf(product), 8);

    const order = await orderOf(created);
    assert.equal(order.paymentStatus, "PAID");
    assert.equal(order.status, "PLACED");
    assert.equal(await cartOf(customer), 0, "cart cleared after a placed order");

    // A second purchase of 3 continues from the new stock.
    await Customer.updateOne({ _id: customer._id }, { $set: { cart: [{ product: product._id, quantity: 3 }] } });
    const second = await checkout(customer);
    assert.equal((await pay(customer, second)).status, 200);
    assert.equal(await stockOf(product), 5);
  });

  test("B: repeated and concurrent verification deducts only once", async () => {
    const product = await makeProduct(10);
    const customer = await makeCustomer([[product, 2]]);
    const created = await checkout(customer);
    const paymentId = "pay_repeat";

    assert.equal((await pay(customer, created, { paymentId })).status, 200);
    assert.equal((await pay(customer, created, { paymentId })).status, 200, "a retry reports success");
    assert.equal(await stockOf(product), 8, "no second deduction");

    // A different payment id for an already paid order is rejected.
    assert.equal((await pay(customer, created, { paymentId: "pay_other" })).status, 400);

    // Five simultaneous verifications of a fresh order: still exactly one deduction.
    await Customer.updateOne({ _id: customer._id }, { $set: { cart: [{ product: product._id, quantity: 2 }] } });
    const fresh = await checkout(customer);
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(customer, fresh, { paymentId: "pay_burst" })));
    assert.ok(results.every((r) => r.status === 200 || r.status === 409), JSON.stringify(results.map((r) => r.status)));
    assert.ok(results.some((r) => r.status === 200));
    assert.equal(await stockOf(product), 6);
    assert.equal((await orderOf(fresh)).status, "PLACED");
  });

  test("C: failed / cancelled payment leaves stock and order untouched", async () => {
    const product = await makeProduct(10);
    const customer = await makeCustomer([[product, 2]]);
    const created = await checkout(customer);

    // Cancelled: the popup was closed, verify is never called.
    assert.equal(await stockOf(product), 10);

    // Forged or failed payment: signature does not verify.
    const forged = await pay(customer, created, { signature: "0".repeat(64) });
    assert.equal(forged.status, 400);
    assert.equal(await stockOf(product), 10);

    const order = await orderOf(created);
    assert.equal(order.paymentStatus, "PENDING");
    assert.equal(order.status, "PENDING");
    assert.equal(await cartOf(customer), 1, "cart kept after a failed payment");
  });

  test("D: insufficient stock is rejected before payment and never goes negative", async () => {
    const product = await makeProduct(1);
    const customer = await makeCustomer([[product, 2]]);

    const created = await checkout(customer);
    assert.equal(created.status, 400, "checkout refuses more than is in stock");
    assert.equal(await Order.countDocuments(), 0, "no order created");
    assert.equal(await stockOf(product), 1);
  });

  test("D2: stock sold out after checkout -> paid order is cancelled and refunded", async () => {
    const product = await makeProduct(2);
    const customer = await makeCustomer([[product, 2]]);
    const created = await checkout(customer);
    assert.equal(created.status, 201);

    // Someone else buys one while this customer is in the payment popup.
    await Product.updateOne({ _id: product._id }, { $inc: { stock: -1 } });

    const verified = await pay(customer, created, { paymentId: "pay_soldout" });
    assert.equal(verified.status, 409);
    assert.match(verified.body.message, /out of stock.*refunded/i);
    assert.equal(await stockOf(product), 1, "stock untouched, never negative");

    const order = await orderOf(created);
    assert.equal(order.status, "CANCELLED", "an unfulfilled order is never PLACED");
    assert.equal(order.paymentStatus, "REFUNDED");
    assert.equal(order.razorpayRefundId, "rfnd_fake1");
    assert.deepEqual(razorpay.refunds, ["pay_soldout"]);
    assert.equal(await cartOf(customer), 1, "cart kept so the customer can adjust it");

    // Retrying reports the same outcome and does not refund twice.
    assert.equal((await pay(customer, created, { paymentId: "pay_soldout" })).status, 409);
    assert.equal(razorpay.refunds.length, 1);
  });

  test("D3: if the automatic refund fails the order stays PAID + CANCELLED for a manual refund", async () => {
    const product = await makeProduct(1);
    const customer = await makeCustomer([[product, 1]]);
    const created = await checkout(customer);
    await Product.updateOne({ _id: product._id }, { $set: { stock: 0 } });
    razorpay.refundShouldFail = true;

    const verified = await pay(customer, created);
    assert.equal(verified.status, 409);
    assert.match(verified.body.message, /will be refunded/i);

    const order = await orderOf(created);
    assert.equal(order.status, "CANCELLED");
    assert.equal(order.paymentStatus, "PAID");
    assert.equal(await stockOf(product), 0);
  });

  test("E: multiple products are all deducted (A 10-2=8, B 5-1=4)", async () => {
    const a = await makeProduct(10);
    const b = await makeProduct(5);
    const customer = await makeCustomer([
      [a, 2],
      [b, 1],
    ]);
    const created = await checkout(customer);

    assert.equal((await pay(customer, created)).status, 200);
    assert.equal(await stockOf(a), 8);
    assert.equal(await stockOf(b), 4);
  });

  test("F: one product short -> no partial deduction on the others", async () => {
    const a = await makeProduct(10);
    const b = await makeProduct(2);
    const customer = await makeCustomer([
      [a, 2],
      [b, 2],
    ]);
    const created = await checkout(customer);
    assert.equal(created.status, 201);
    await Product.updateOne({ _id: b._id }, { $set: { stock: 1 } });

    const verified = await pay(customer, created);
    assert.equal(verified.status, 409);
    assert.equal(await stockOf(a), 10, "A rolled back, not left at 8");
    assert.equal(await stockOf(b), 1);
    assert.equal((await orderOf(created)).status, "CANCELLED");
  });

  test("G: two buyers race for the last unit -> exactly one succeeds", async () => {
    const product = await makeProduct(1);
    const first = await makeCustomer([[product, 1]]);
    const second = await makeCustomer([[product, 1]]);

    // Both pass the pre-payment check while 1 is still in stock.
    const [orderOne, orderTwo] = await Promise.all([checkout(first), checkout(second)]);
    assert.equal(orderOne.status, 201);
    assert.equal(orderTwo.status, 201);

    const results = await Promise.all([pay(first, orderOne), pay(second, orderTwo)]);
    const statuses = results.map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 409]);
    assert.equal(await stockOf(product), 0, "never negative");

    const orders = await Order.find({}).sort({ status: 1 });
    assert.deepEqual(orders.map((o) => o.status).sort(), ["CANCELLED", "PLACED"]);
    assert.equal(razorpay.refunds.length, 1, "the losing buyer is refunded");
  });
});
