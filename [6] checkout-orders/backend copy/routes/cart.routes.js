const express = require("express");

const {
  addToCart,
  getCart,
  updateCartQuantity,
  removeFromCart,
} = require("../controllers/cart.controller");
const protect = require("../middlewares/auth.middleware");

const router = express.Router();

// Every cart route belongs to the signed-in customer.
router.use(protect);

router.get("/", getCart);
router
  .route("/:productId")
  .post(addToCart)
  .patch(updateCartQuantity)
  .delete(removeFromCart);

module.exports = router;
