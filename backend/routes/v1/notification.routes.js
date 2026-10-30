const { Router } = require('express');
const { list, markRead } = require('../../controllers/notification.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();
router.use(protect);
router.get('/', list);
router.post('/mark-read', markRead);

module.exports = router;
