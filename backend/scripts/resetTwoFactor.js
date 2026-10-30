require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const Admin = require('../models/admin.model');
const Organization = require('../models/organization.model');
const { mongoUri } = require('../config/env');
const { CLEAR_TWO_FACTOR } = require('../utils/twoFactor');

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

async function run() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const yes = process.argv.includes('--yes');
  const email = (args[0] || '').toLowerCase().trim();
  const slug = (args[1] || '').toLowerCase().trim();
  if (!email) {
    console.error('Usage: npm run reset:2fa -- <email> [organization-slug] [--yes]');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);

  const query = { email };
  if (slug) {
    const org = await Organization.findOne({ slug });
    if (!org) throw new Error(`Organization "${slug}" not found`);
    query.organizationId = org._id;
  }
  const matches = await Admin.find(query).select('email role organizationId twoFactorEnabled twoFactorSetupRequired');
  if (matches.length === 0) throw new Error('No admin found with that email.');
  if (matches.length > 1) {
    throw new Error('More than one account uses that email — pass the organization slug as the 2nd argument.');
  }
  const admin = matches[0];
  if (!admin.twoFactorEnabled && !admin.twoFactorSetupRequired) {
    console.log(`${admin.email} does not have 2FA enabled — nothing to reset.`);
    await mongoose.disconnect();
    return;
  }
  if (!yes) {
    console.log(`About to RESET two-factor authentication for ${admin.email} (${admin.role}).`);
    console.log('All their sessions will be signed out and they must set up a new authenticator at next sign-in.');
    const typed = await ask(`Type the email address to confirm: `);
    if (typed.trim().toLowerCase() !== admin.email) {
      console.log('Email did not match — nothing changed.');
      await mongoose.disconnect();
      process.exit(1);
    }
  }
  await Admin.updateOne(
    { _id: admin._id },
    {
      ...CLEAR_TWO_FACTOR,
      $set: { ...CLEAR_TWO_FACTOR.$set, twoFactorSetupRequired: true },
      $inc: { refreshTokenVersion: 1 },
    },
    { strict: false }
  );
  console.log(
    `[${new Date().toISOString()}] 2FA reset for ${admin.email} (${admin.role}). ` +
      'They must sign in with their password and enrol a NEW authenticator before reaching the dashboard.'
  );
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});