/**
 * Seeds the products collection with sample catalog data.
 *
 *   npm run seed
 *
 * Idempotent: each product is upserted by name, so running it twice does not
 * create duplicates, and products created by other means are left untouched.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/product.model");

const unsplash = (id) =>
  `https://images.unsplash.com/photo-${id}?w=800&q=80&auto=format&fit=crop`;

const products = [
  {
    name: "Wireless Slim Keyboard",
    description:
      "Low-profile wireless keyboard with scissor-switch keys, a full numeric keypad and up to 3 months of battery life on a single charge.",
    price: 2999,
    category: "Electronics",
    image: unsplash("1587829741301-dc798b83add3"),
    stock: 10,
  },
  {
    name: "Over-Ear Bluetooth Headphones",
    description:
      "Closed-back over-ear headphones with active noise cancellation, 40 mm drivers and 30-hour battery life.",
    price: 4499,
    category: "Electronics",
    image: unsplash("1505740420928-5e560c06d30e"),
    stock: 25,
  },
  {
    name: "Smartwatch with Heart Rate Monitor",
    description:
      "Lightweight smartwatch with heart-rate and sleep tracking, step counter, notifications and 5 ATM water resistance.",
    price: 5999,
    category: "Electronics",
    image: unsplash("1523275335684-37898b6baf30"),
    stock: 4,
  },
  {
    name: "Men's Running Shoes",
    description:
      "Breathable knit running shoes with a cushioned midsole and rubber outsole for everyday training.",
    price: 3499,
    category: "Fashion",
    image: unsplash("1542291026-7eec264c27ff"),
    stock: 18,
  },
  {
    name: "Classic Cotton T-Shirt",
    description:
      "Everyday crew-neck T-shirt in 100% combed cotton. Pre-shrunk, soft and breathable.",
    price: 599,
    category: "Fashion",
    image: unsplash("1521572163474-6864f9cf17ab"),
    stock: 60,
  },
  {
    name: "Everyday Laptop Backpack",
    description:
      "Water-resistant 22 L backpack with a padded 15.6-inch laptop sleeve and front organiser pocket.",
    price: 1899,
    category: "Fashion",
    image: unsplash("1553062407-98eeb64c6a62"),
    stock: 0,
  },
  {
    name: "Startup & Business Book Bundle",
    description:
      "A stack of eight bestselling books on startups, product design and entrepreneurship.",
    price: 3999,
    category: "Books",
    image: unsplash("1512820790803-83ca734da794"),
    stock: 7,
  },
  {
    name: "Modern Poetry Collection",
    description:
      "Paperback collection of contemporary poetry about love, loss and healing.",
    price: 399,
    category: "Books",
    image: unsplash("1544947950-fa07a98d237f"),
    stock: 35,
  },
  {
    name: "Adjustable Desk Lamp",
    description:
      "Metal desk lamp with an adjustable arm and tilting shade. Works with any E27 bulb.",
    price: 1499,
    category: "Home",
    image: unsplash("1507473885765-e6ed057f782c"),
    stock: 12,
  },
  {
    name: "Ceramic Coffee Mug",
    description:
      "350 ml matte white ceramic mug. Microwave and dishwasher safe.",
    price: 349,
    category: "Home",
    image: unsplash("1514228742587-6b1558fcca3d"),
    stock: 80,
  },
];

const seed = async () => {
  await connectDB();

  for (const product of products) {
    await Product.findOneAndUpdate({ name: product.name }, product, {
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
  }

  const total = await Product.countDocuments();
  console.log(`[seed] Upserted ${products.length} products (${total} in collection)`);
};

seed()
  .catch((error) => {
    console.error(`[seed] Failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
