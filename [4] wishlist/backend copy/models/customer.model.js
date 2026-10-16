const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

const customerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [3, "Full name must be at least 3 characters long"],
      maxlength: [60, "Full name must not exceed 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      // Password is never returned by a normal query. Login explicitly
      // re-selects it with .select("+password").
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [
        /^\+?\d{10,15}$/,
        "Phone number must be 10 to 15 digits, optionally prefixed with +",
      ],
    },
    // Only Product ObjectIds are stored; GET /wishlist populates them.
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

/**
 * Hash the password with bcrypt before it ever reaches the database.
 * Runs only when the password field actually changed, so profile updates
 * do not re-hash an already hashed value.
 */
customerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Compares a plain text candidate password against the stored hash.
 * Guards against being called on a document fetched without "+password",
 * and against a non-string candidate, either of which would otherwise make
 * bcrypt throw "data and hash must be strings".
 *
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
customerSchema.methods.comparePassword = async function (candidatePassword) {
  if (typeof candidatePassword !== "string" || typeof this.password !== "string") {
    return false;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Safety net: strip the password (and __v) from any serialised document,
 * even if it was explicitly selected somewhere.
 */
customerSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

const Customer = mongoose.model("Customer", customerSchema);

module.exports = Customer;
