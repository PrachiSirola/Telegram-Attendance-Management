require('dotenv').config();
const mongoose = require('mongoose');
const { mongoUri } = require('../config/env');
const logger = require('../utils/logger');

const INDEX_KEY = { organizationId: 1, telegramId: 1 };
const INDEX_NAME = 'organizationId_1_telegramId_1';

async function run() {
  await mongoose.connect(mongoUri);
  const col = mongoose.connection.collection('employees');

  const existing = await col.indexes();
  const match = existing.find(
    (i) => i.key && i.key.organizationId === 1 && i.key.telegramId === 1
  );

  if (match) {
    const alreadyCorrect =
      match.unique &&
      match.partialFilterExpression &&
      JSON.stringify(match.partialFilterExpression) === JSON.stringify({ telegramId: { $type: 'string' } });

    if (alreadyCorrect) {
      logger.info(`Index "${match.name}" is already correct — nothing to do.`);
      await mongoose.disconnect();
      process.exit(0);
    }

    logger.info(`Dropping outdated index "${match.name}" (unique=${match.unique}, sparse=${!!match.sparse})...`);
    await col.dropIndex(match.name);
  } else {
    logger.info('No existing organizationId+telegramId index found on the employees collection.');
  }

  logger.info('Creating corrected partial unique index...');
  await col.createIndex(INDEX_KEY, {
    unique: true,
    name: INDEX_NAME,
    partialFilterExpression: { telegramId: { $type: 'string' } },
  });

  logger.info('Done. Employees without a linked Telegram account can now coexist freely.');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error('Telegram index migration failed', err);
  process.exit(1);
});