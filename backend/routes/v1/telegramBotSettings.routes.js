const { Router } = require('express');
const { getSettings, updateSettings, revealToken } = require('../../controllers/telegramBotSettings.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();

router.use(protect);

router.get('/settings', getSettings);
router.patch('/settings', updateSettings);
router.get('/settings/token', revealToken);

module.exports = router;