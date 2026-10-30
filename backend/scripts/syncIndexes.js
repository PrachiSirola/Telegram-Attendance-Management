require('dotenv').config();
const mongoose = require('mongoose');
const { mongoUri } = require('../config/env');

require('../models/admin.model');
require('../models/organization.model');
require('../models/employee.model');
require('../models/attendance.model');
require('../models/leaveRequest.model');
require('../models/activityLog.model');
require('../models/notification.model');
require('../models/offDay.model');

(async () => {
  await mongoose.connect(mongoUri);
  let created = 0;
  let failed = 0;
  for (const name of mongoose.modelNames()) {
    const Model = mongoose.model(name);
    const existing = await Model.collection.indexes().catch(() => []);
    const have = new Set(existing.map((i) => i.name));
    for (const [fields, options] of Model.schema.indexes()) {
      const opts = { ...options };
      delete opts.background;
      try {
        const idxName = await Model.collection.createIndex(fields, opts);
        if (!have.has(idxName)) {
          created += 1;
          console.log(`+ ${name}: created ${idxName}`);
        }
      } catch (e) {
        failed += 1;
        console.warn(`! ${name}: ${JSON.stringify(fields)} skipped — ${e.message}`);
      }
    }
  }
  console.log(`Done. ${created} index(es) created, ${failed} skipped.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});