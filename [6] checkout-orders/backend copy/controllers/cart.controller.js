const Customer = require("../models/customer.model");
const Product = require("../models/product.model");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Responds with the customer's cart, products populated. Every endpoint
 * returns the full cart so the client can replace its state in one step.
 * Rows whose product was deleted from the catalog populate to null and are
 * dropped.
 */
const sendCart = async (res, customerId, status, message) => {
  const customer = await Customer.findById(customerId).populate("cart.product");
  const cart = customer ? customer.cart.filter((item) => item.product) : [];

  return res.status(status).json({ success: true, message, count: cart.length, cart });
};

/**
 * @desc    Add one unit of a product to the cart (new row, or quantity + 1)
 * @route   POST /cart/:productId
 * @access  Private
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!OBJECT_ID_PATTERN.test(productId)) return fail(res, 400, "Invalid product id");

    const product = await Product.findById(productId);

    if (!product) return fail(res, 404, "Product not found");
    if (product.stock < 1) return fail(res, 400, "Product is out of stock");

    // Already in the cart: increment, but only while still below stock. The
    // stock check and the $inc are one atomic update.
    const incremented = await Customer.updateOne(
      { _id: req.user._id, cart: { $elemMatch: { product: productId, quantity: { $lt: product.stock } } } },
      { $inc: { "cart.$.quantity": 1 } }
    );

    if (incremented.modifiedCount === 1) {
      return sendCart(res, req.user._id, 200, "Cart quantity updated");
    }

    // Not in the cart yet: push a new row. The `$ne` guard makes duplicate
    // rows impossible even if two requests race.
    const pushed = await Customer.updateOne(
      { _id: req.user._id, "cart.product": { $ne: productId } },
      { $push: { cart: { product: productId, quantity: 1 } } }
    );

    if (pushed.modifiedCount === 1) {
      return sendCart(res, req.user._id, 201, "Product added to cart");
    }

    // Neither update applied: the row exists and is already at stock.
    return fail(res, 400, `Only ${product.stock} in stock`);
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Get the signed-in customer's cart with full product details
 * @route   GET /cart
 * @access  Private
 */
const getCart = async (req, res, next) => {
  try {
    return await sendCart(res, req.user._id, 200, "Cart fetched");
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Set the quantity of a product already in the cart
 * @route   PATCH /cart/:productId   body: { quantity }
 * @access  Private
 */
const updateCartQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const quantity = req.body ? req.body.quantity : undefined;

    if (!OBJECT_ID_PATTERN.test(productId)) return fail(res, 400, "Invalid product id");

    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      return fail(res, 400, "Quantity must be a whole number");
    }
    if (quantity < 1) return fail(res, 400, "Quantity must be at least 1");

    const product = await Product.findById(productId);

    if (!product) return fail(res, 404, "Product not found");
    if (quantity > product.stock) return fail(res, 400, `Only ${product.stock} in stock`);

    const result = await Customer.updateOne(
      { _id: req.user._id, "cart.product": productId },
      { $set: { "cart.$.quantity": quantity } }
    );

    if (result.matchedCount === 0) return fail(res, 404, "Product is not in your cart");

    return sendCart(res, req.user._id, 200, "Cart quantity updated");
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Remove a product row from the cart
 * @route   DELETE /cart/:productId
 * @access  Private
 *
 * Idempotent like the wishlist: removing a product that is not in the cart
 * still succeeds, the end state is what the client asked for.
 */
const removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!OBJECT_ID_PATTERN.test(productId)) return fail(res, 400, "Invalid product id");

    await Customer.updateOne({ _id: req.user._id }, { $pull: { cart: { product: productId } } });

    return sendCart(res, req.user._id, 200, "Product removed from cart");
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
};
