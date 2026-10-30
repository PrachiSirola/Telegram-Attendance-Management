const Notification = require('../models/notification.model');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  const { unread, limit = 50 } = req.query;
  const filter = { targetAdmin: true, organizationId: req.organizationId };
  if (unread === 'true') filter.read = false;
  const items = await Notification.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
  res.json({ success: true, data: items });
});

const markRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { _id: { $in: req.body.ids }, organizationId: req.organizationId },
    { $set: { read: true } }
  );
  res.json({ success: true });
});

module.exports = { list, markRead };
