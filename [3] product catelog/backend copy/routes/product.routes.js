const express = require("express");

const {
  createProduct,
  getProducts,
  getProductById,
} = require("../controllers/product.controller");

const router = express.Router();

// GET handles listing, search and category filtering through query params,
// so there is a single collection endpoint rather than one per filter.
router.route("/").get(getProducts).post(createProduct);

router.get("/:id", getProductById);

module.exports = router;
