const express = require("express");

const {
  createPaymentOrder,
  verifyPayment,
  getMyOrders,
  getOrderById,
} = require("../controllers/order.controller");
const protect = require("../middlewares/auth.middleware");

const router = express.Router();

// Every order route belongs to the signed-in customer.
router.use(protect);

router.post("/create-payment-order", createPaymentOrder);
router.post("/verify-payment", verifyPayment);
router.get("/", getMyOrders);
router.get("/:id", getOrderById);

module.exports = router;
