const mongoose = require('mongoose');
const { mongoUri, nodeEnv } = require('./env');

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri, {
    autoIndex: nodeEnv !== 'production',
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 10000,
    minPoolSize: 10,
    maxIdleTimeMS: 5 * 60 * 1000,
    maxConnecting: 6,
  });
  return mongoose.connection;
}

module.exports = connectDB;