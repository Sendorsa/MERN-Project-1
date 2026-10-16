const mongoose = require("mongoose");

/**
 * Establishes the MongoDB connection used by the whole application.
 * Exits the process on failure - the API is useless without a database.
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("[db] MONGODB_URI is not defined in the environment");
    process.exit(1);
  }

  try {
    const connection = await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    console.error(`[db] MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
