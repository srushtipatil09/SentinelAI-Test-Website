const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async (sdk) => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sentinel_demo';

  // Apply Sentinel Mongoose Middleware Plugin
  if (sdk && typeof sdk.mongooseMiddleware === 'function') {
    mongoose.plugin(sdk.mongooseMiddleware());
    console.log('[Database] Sentinel Mongoose middleware plugin registered.');
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2000
    });
    isConnected = true;
    console.log(`\x1b[32m[Database]\x1b[0m MongoDB Connected successfully to ${mongoUri}`);
    if (sdk) {
      sdk.captureLog('INFO', 'MongoDB connection established', { mongoUri });
    }
  } catch (err) {
    isConnected = false;
    console.warn(`\x1b[33m[Database]\x1b[0m MongoDB Connection Notice: ${err.message}. Running in in-memory mode for DB routes.`);
    if (sdk) {
      sdk.captureLog('WARN', 'MongoDB connection fallback to in-memory store', { error: err.message });
    }
  }
};

const getStatus = () => isConnected;

module.exports = { connectDB, getStatus };
