require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const connectDB = require("./config/db");
const customerRoutes = require("./routes/customer.routes");
const productRoutes = require("./routes/product.routes");
const wishlistRoutes = require("./routes/wishlist.routes");
const cartRoutes = require("./routes/cart.routes");

const app = express();
const PORT = process.env.PORT || 5000;

// --- Global middleware ------------------------------------------------
// The React app runs on a different origin (port). credentials: true is
// required for the browser to send and accept the HttpOnly auth cookie.
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// --- Health check -----------------------------------------------------
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ShopKart API is running",
  });
});

// --- Feature routes ---------------------------------------------------
app.use("/customers", customerRoutes);
app.use("/products", productRoutes);
app.use("/wishlist", wishlistRoutes);
app.use("/cart", cartRoutes);

// --- 404 handler ------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// --- Centralised error handler ----------------------------------------
// Express identifies this as an error handler by its four arguments.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Always log the full error server side - this is the only place it exists.
  console.error("[error]", err.stack || err.message);

  // express.json() raises a SyntaxError carrying a 400 status when the request
  // body is not valid JSON. Honour that rather than reporting it as a crash.
  const status = err.statusCode || err.status || 500;

  if (err instanceof SyntaxError && status === 400) {
    return res.status(400).json({
      success: false,
      message: "Request body is not valid JSON",
    });
  }

  // Never leak internal error text to the client on a server fault. Client
  // errors (4xx) carry messages that are safe and useful to the caller.
  return res.status(status).json({
    success: false,
    message: status >= 500 ? "Internal server error" : err.message,
  });
});

/**
 * Connect to MongoDB first, then start accepting requests, so the server
 * never serves traffic it cannot fulfil.
 */
const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`[server] Listening on http://localhost:${PORT}`);
  });

  // app.listen reports failures such as EADDRINUSE as an 'error' event, not a
  // rejected promise. Without this listener the process dies on a raw stack.
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`[server] Port ${PORT} is already in use`);
    } else {
      console.error(`[server] Failed to start: ${error.message}`);
    }
    process.exit(1);
  });

  return server;
};

// Surface any startup rejection instead of leaving an unhandled promise.
startServer().catch((error) => {
  console.error(`[server] Startup failed: ${error.message}`);
  process.exit(1);
});

module.exports = app;
