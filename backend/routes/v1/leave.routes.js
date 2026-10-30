const { Router } = require('express');
const { body, param } = require('express-validator');
const { list, counts, apply, approve, reject } = require('../../controllers/leave.controller');
const { protect } = require('../../middlewares/auth');
const requireActiveOrg = require('../../middlewares/requireActiveOrg');

const router = Router();

router.get('/', protect, list);
router.get('/counts', protect, counts);
router.post(
  '/apply',
  protect,
  requireActiveOrg,
  body('employeeId').isMongoId(),
  body('startDate').isISO8601({ strict: false }),
  body('endDate').isISO8601({ strict: false }),
  body('leaveType').isIn(['Casual Leave', 'Sick Leave', 'Other']),
  apply
);

router.post(
  '/:id/approve',
  protect,
  param('id').isMongoId(),
  body('approveAs').optional({ nullable: true }).isIn(['paid', 'unpaid']),
  approve
);
router.post('/:id/reject', protect, param('id').isMongoId(), reject);

module.exports = router;