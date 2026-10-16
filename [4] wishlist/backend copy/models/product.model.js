const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [120, "Product name must not exceed 120 characters"],
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      maxlength: [2000, "Product description must not exceed 2000 characters"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Price must be a number greater than 0",
      },
    },
    category: {
      type: String,
      required: [true, "Product category is required"],
      trim: true,
      // Category filtering is an exact-match query, so index it.
      index: true,
    },
    image: {
      type: String,
      required: [true, "Product image is required"],
      trim: true,
    },
    stock: {
      type: Number,
      required: [true, "Product stock is required"],
      validate: {
        validator: (value) => Number.isInteger(value) && value >= 0,
        message: "Stock must be a whole number greater than or equal to 0",
      },
    },
  },
  // createdAt / updatedAt are generated automatically.
  { timestamps: true }
);

productSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
