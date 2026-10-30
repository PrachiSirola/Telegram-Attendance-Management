const { Router } = require('express');
const { body, param } = require('express-validator');
const { list, create, remove } = require('../../controllers/offDay.controller');
const { protect } = require('../../middlewares/auth');
const requireActiveOrg = require('../../middlewares/requireActiveOrg');
const { requireRole } = require('../../middlewares/role');

const router = Router();

router.use(protect);

router.get('/', list);
router.post(
  '/',
  requireActiveOrg,
  requireRole('admin', 'super_admin'),
  body('date').isISO8601({ strict: false }),
  body('type').isIn(['weekly_off', 'festival', 'other']),
  body('scope').optional().isIn(['org', 'department', 'employee']),
  create
);
router.delete('/:id', requireActiveOrg, requireRole('admin', 'super_admin'), param('id').isMongoId(), remove);

module.exports = router;