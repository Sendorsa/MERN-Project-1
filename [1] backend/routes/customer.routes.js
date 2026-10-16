const express = require("express");

const {
  registerCustomer,
  loginCustomer,
  getMyProfile,
  logoutCustomer,
} = require("../controllers/customer.controller");
const protect = require("../middlewares/auth.middleware");

const router = express.Router();

// --- Public routes ----------------------------------------------------
router.post("/register", registerCustomer);
router.post("/login", loginCustomer);

// Logout is public on purpose: it must stay idempotent so that a customer
// holding an expired or malformed token can still clear it.
router.post("/logout", logoutCustomer);

// --- Protected routes -------------------------------------------------
router.get("/me", protect, getMyProfile);

module.exports = router;
