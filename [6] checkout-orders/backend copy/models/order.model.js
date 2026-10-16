const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      // Every order query filters by user.
      index: true,
    },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1 },
        // Unit price at the time of purchase, so later price changes do not
        // rewrite order history.
        price: { type: Number, required: true, min: 0 },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
    },
    // Rupees. Razorpay is sent this value x 100 (paise).
    totalAmount: { type: Number, required: true, min: 0 },
    // REFUNDED: paid, but refunded because the order could not be fulfilled.
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "REFUNDED"],
      default: "PENDING",
    },
    // PLACED only after payment is verified AND stock was deducted.
    // CANCELLED: payment verified but stock ran out before it completed.
    status: {
      type: String,
      enum: ["PENDING", "PLACED", "CANCELLED"],
      default: "PENDING",
    },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: String,
    razorpayRefundId: String,
    // Why a paid order was cancelled, shown to the customer.
    failureReason: String,
  },
  { timestamps: true }
);

orderSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
