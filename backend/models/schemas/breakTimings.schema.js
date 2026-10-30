const mongoose = require('mongoose');
const breakSlotSchema = new mongoose.Schema(
  {
    start: { type: String, trim: true },
    durationMins: { type: Number },
  },
  { _id: false }
);

const breakTimingsSchema = new mongoose.Schema(
  {
    morning: { type: breakSlotSchema, default: () => ({ durationMins: 15 }) },
    lunch: { type: breakSlotSchema, default: () => ({ durationMins: 30 }) },
    evening: { type: breakSlotSchema, default: () => ({ durationMins: 15 }) },
  },
  { _id: false }
);

module.exports = breakTimingsSchema;