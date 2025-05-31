const mongoose = require('mongoose');
const config = require('../config');

async function connectToMongo() {
  try {
    await mongoose.connect(config.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB Connected!');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
  }
}

module.exports = { connectToMongo };