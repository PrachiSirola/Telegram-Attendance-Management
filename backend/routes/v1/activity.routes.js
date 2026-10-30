const { Router } = require('express');
const { list, counts, create } = require('../../controllers/activity.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();
router.use(protect);
router.get('/', list);
router.get('/counts', counts);
router.post('/', create);

module.exports = router;