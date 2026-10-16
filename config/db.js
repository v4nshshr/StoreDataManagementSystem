const mongoose = require('mongoose');

/**
 * MongoDB Connection Handler with Serverless Connection Caching
 * 
 * Works seamlessly both in persistent environments (Localhost, Docker, VPS)
 * and serverless platforms (Vercel, AWS Lambda) by caching the connection.
 */
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState >= 1) {
    return cachedConnection;
  }

  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/retail_store_db';
    
    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    cachedConnection = conn;
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    if (process.env.NODE_ENV !== 'production') {
      // Don't kill serverless lambda processes in production
      console.error('Failed to establish MongoDB connection.');
    }
    throw error;
  }
};

module.exports = connectDB;
