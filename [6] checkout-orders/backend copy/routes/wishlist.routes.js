const express = require("express");

const {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} = require("../controllers/wishlist.controller");
const protect = require("../middlewares/auth.middleware");

const router = express.Router();

// Every wishlist route belongs to the signed-in customer.
router.use(protect);

router.get("/", getWishlist);
router.route("/:productId").post(addToWishlist).delete(removeFromWishlist);

module.exports = router;
