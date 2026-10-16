/**
 * Smoke test for the orders API. Needs the server running (npm run dev) and
 * at least one product with stock >= 1.
 *   node scripts/test-orders.js
 *
 * With Razorpay test keys in .env the real create-payment-order call is made.
 * Without them that call must answer 503, and a PENDING order is inserted
 * directly so the verification logic is still exercised.
 * Signatures are computed here with RAZORPAY_KEY_SECRET exactly as Razorpay
 * does, so no real payment is needed. Test users and orders are deleted after.
 */
require("dotenv").config();
const crypto = require("crypto");
const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");

const API = process.env.API || `http://localhost:${process.env.PORT || 5000}`;
const SECRET = process.env.RAZORPAY_KEY_SECRET;
const HAS_KEYS = Boolean(process.env.RAZORPAY_KEY_ID && SECRET);
const ADDRESS = {
  fullName: "Order Tester",
  phone: "9876543210",
  address: "12 MG Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

let passed = 0;
let failed = 0;
const check = (name, expected, actual) => {
  const ok = expected === actual;
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} (${ok ? actual : `expected ${expected}, got ${actual}`})`);
};

const sign = (razorpayOrderId, paymentId) =>
  crypto.createHmac("sha256", SECRET || "").update(`${razorpayOrderId}|${paymentId}`).digest("hex");

/** Minimal cookie-keeping client. */
const client = () => {
  let cookie = "";
  return async (method, path, body) => {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: body && JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0];
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
};

const signUp = async (req, tag) => {
  const email = `orders-${tag}-${Date.now()}@test.com`;
  const user = { fullName: "Order Tester", email, password: "secret123", phone: "9876543210" };
  await req("POST", "/customers/register", user);
  await req("POST", "/customers/login", { email, password: "secret123" });
  return email;
};

const main = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const emails = [];
  console.log(`API ${API} | Razorpay keys ${HAS_KEYS ? "present" : "missing"}`);

  try {
    const guest = client();
    for (const [method, path] of [
      ["POST", "/orders/create-payment-order"],
      ["POST", "/orders/verify-payment"],
      ["GET", "/orders"],
      ["GET", "/orders/000000000000000000000000"],
    ]) {
      check(`401 without login: ${method} ${path}`, 401, (await guest(method, path)).status);
    }

    const req = client();
    emails.push(await signUp(req, "a"));

    let r = await req("POST", "/orders/create-payment-order", { shippingAddress: ADDRESS });
    check("empty cart -> 400", 400, r.status);

    const { data: list } = await req("GET", "/products");
    const product = list.products.find((p) => p.stock >= 1);
    await req("POST", `/cart/${product._id}`);

    r = await req("POST", "/orders/create-payment-order", {});
    check("missing address -> 400", 400, r.status);
    r = await req("POST", "/orders/create-payment-order", { shippingAddress: { ...ADDRESS, pincode: "12" } });
    check("bad pincode -> 400", 400, r.status);
    r = await req("POST", "/orders/create-payment-order", { shippingAddress: { ...ADDRESS, city: { $ne: null } } });
    check("operator injection in address -> 400", 400, r.status);

    let orderId;
    let razorpayOrderId;
    r = await req("POST", "/orders/create-payment-order", { shippingAddress: ADDRESS });
    if (HAS_KEYS) {
      check("create-payment-order -> 201", 201, r.status);
      check("  amount in paise", Math.round(product.price * 100), r.data.amount);
      check("  keyId returned", process.env.RAZORPAY_KEY_ID, r.data.keyId);
      check("  razorpayOrderId looks real", true, /^order_/.test(r.data.razorpayOrderId || ""));
      ({ orderId, razorpayOrderId } = r.data);
    } else {
      check("create-payment-order without keys -> 503", 503, r.status);
      check("  no orphan order left behind", 0, (await req("GET", "/orders")).data.count);
      razorpayOrderId = `order_LOCALTEST${Date.now()}`;
      const customer = await Customer.findOne({ email: emails[0] });
      const order = await Order.create({
        user: customer._id,
        items: [{ product: product._id, quantity: 1, price: product.price }],
        shippingAddress: ADDRESS,
        totalAmount: product.price,
        razorpayOrderId,
      });
      orderId = order._id.toString();
    }

    r = await req("GET", "/cart");
    check("cart NOT cleared by create-payment-order", 1, r.data.count);
    r = await req("GET", `/orders/${orderId}`);
    check("new order is PENDING/PENDING", "PENDING/PENDING", `${r.data.order.paymentStatus}/${r.data.order.status}`);

    const paymentId = `pay_LOCALTEST${Date.now()}`;
    const payload = { orderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId };

    r = await req("POST", "/orders/verify-payment", { ...payload, razorpay_signature: "deadbeef" });
    check("wrong signature -> 400", 400, r.status);
    r = await req("POST", "/orders/verify-payment", {
      ...payload,
      razorpay_signature: sign(razorpayOrderId, `${paymentId}x`),
    });
    check("signature for another payment -> 400", 400, r.status);
    r = await req("POST", "/orders/verify-payment", {
      ...payload,
      razorpay_order_id: "order_OTHER",
      razorpay_signature: sign("order_OTHER", paymentId),
    });
    check("signature for another Razorpay order -> 400", 400, r.status);
    r = await req("POST", "/orders/verify-payment", { orderId: "abc" });
    check("missing fields -> 400", 400, r.status);
    check("cart still intact after failed verifications", 1, (await req("GET", "/cart")).data.count);

    if (SECRET) {
      const good = { ...payload, razorpay_signature: sign(razorpayOrderId, paymentId) };
      r = await req("POST", "/orders/verify-payment", good);
      check("valid signature -> 200", 200, r.status);
      check("  order PAID/PLACED", "PAID/PLACED", `${r.data.order?.paymentStatus}/${r.data.order?.status}`);
      check("  payment id saved", paymentId, r.data.order?.razorpayPaymentId);
      check("cart cleared after verified payment", 0, (await req("GET", "/cart")).data.count);
      const after = (await req("GET", `/products/${product._id}`)).data.product.stock;
      check("  stock deducted by 1", product.stock - 1, after);
      r = await req("POST", "/orders/verify-payment", good);
      check("repeat verification is idempotent -> 200", 200, r.status);
      check("  no second stock deduction", product.stock - 1, (await req("GET", `/products/${product._id}`)).data.product.stock);
    } else {
      console.log("SKIP  valid-signature tests (no RAZORPAY_KEY_SECRET)");
    }

    // A second, newer order to check sorting.
    const me = await Customer.findOne({ email: emails[0] });
    const newer = await Order.create({
      user: me._id,
      items: [{ product: product._id, quantity: 2, price: product.price }],
      shippingAddress: ADDRESS,
      totalAmount: product.price * 2,
    });
    r = await req("GET", "/orders");
    check("GET /orders -> 200", 200, r.status);
    check("  newest first", newer._id.toString(), r.data.orders[0]?._id);

    r = await req("GET", `/orders/${orderId}`);
    check("GET /orders/:id own order -> 200", 200, r.status);
    check("  items populated with name", product.name, r.data.order?.items[0]?.product?.name);
    check("invalid order id -> 400", 400, (await req("GET", "/orders/xyz")).status);
    check("unknown order id -> 404", 404, (await req("GET", "/orders/000000000000000000000000")).status);

    const other = client();
    emails.push(await signUp(other, "b"));
    check("another user's order -> 404", 404, (await other("GET", `/orders/${orderId}`)).status);
    check("another user's list excludes it", 0, (await other("GET", "/orders")).data.count);
    r = await other("POST", "/orders/verify-payment", { ...payload, razorpay_signature: sign(razorpayOrderId, paymentId) });
    check("another user cannot verify it -> 404", 404, r.status);
  } finally {
    const users = await Customer.find({ email: { $in: emails } }, "_id");
    const userFilter = { user: { $in: users.map((u) => u._id) } };
    // A verified payment deducts real catalog stock; give it back.
    for (const order of await Order.find({ ...userFilter, status: "PLACED" })) {
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
      }
    }
    await Order.deleteMany(userFilter);
    await Customer.deleteMany({ email: { $in: emails } });
    await mongoose.disconnect();
  }

  console.log(`---- ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
