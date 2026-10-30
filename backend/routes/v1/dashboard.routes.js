const { Router } = require('express');
const { summary, details } = require('../../controllers/dashboard.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();
router.use(protect);
router.get('/summary', summary);
router.get('/details/:category', details);

module.exports = router;