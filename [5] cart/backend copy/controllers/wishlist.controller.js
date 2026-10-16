const Customer = require("../models/customer.model");
const Product = require("../models/product.model");

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const invalidId = (res) =>
  res.status(400).json({ success: false, message: "Invalid product id" });

/**
 * @desc    Add a product to the signed-in customer's wishlist
 * @route   POST /wishlist/:productId
 * @access  Private
 */
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!OBJECT_ID_PATTERN.test(productId)) return invalidId(res);

    const productExists = await Product.exists({ _id: productId });

    if (!productExists) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // The `$ne` condition and the push run as one atomic update, so two rapid
    // clicks can never store the same product twice.
    const result = await Customer.updateOne(
      { _id: req.user._id, wishlist: { $ne: productId } },
      { $push: { wishlist: productId } }
    );

    if (result.modifiedCount === 0) {
      return res.status(409).json({ success: false, message: "Product already in wishlist" });
    }

    return res.status(200).json({ success: true, message: "Product added to wishlist" });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    List the signed-in customer's wishlist with full product details
 * @route   GET /wishlist
 * @access  Private
 */
const getWishlist = async (req, res, next) => {
  try {
    // Products deleted since being wishlisted populate to null and are dropped.
    const customer = await Customer.findById(req.user._id).populate("wishlist");
    const wishlist = customer ? customer.wishlist : [];

    return res.status(200).json({ success: true, count: wishlist.length, wishlist });
  } catch (error) {
    return next(error);
  }
};

/**
 * @desc    Remove a product from the signed-in customer's wishlist
 * @route   DELETE /wishlist/:productId
 * @access  Private
 *
 * Idempotent: removing a product that is not in the wishlist still succeeds,
 * the end state the client asked for is the same.
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!OBJECT_ID_PATTERN.test(productId)) return invalidId(res);

    await Customer.updateOne({ _id: req.user._id }, { $pull: { wishlist: productId } });

    return res.status(200).json({ success: true, message: "Product removed from wishlist" });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
};
