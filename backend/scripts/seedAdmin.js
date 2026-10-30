require('dotenv').config();
const mongoose = require('mongoose');
const ensureSeedAdmin = require('../utils/ensureSeedAdmin');
const { mongoUri } = require('../config/env');

async function run() {
  await mongoose.connect(mongoUri);
  const email = process.argv[2] || process.env.SEED_ADMIN_EMAIL || 'ronnieewood@mailinator.com';
  const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

  await ensureSeedAdmin({ email, password });
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});