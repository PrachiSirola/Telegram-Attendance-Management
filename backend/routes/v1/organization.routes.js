const { Router } = require('express');
const { param } = require('express-validator');
const {
  lookupBySlug,
  getCurrentOrgDefaults,
  listTimezones,
  listAll,
  create,
  update,
  updateFeatureToggles,
  remove,
  createAdminInOrg,
  listAdminsInOrg,
  updateAdminInOrg,
  resetAdminTwoFactor,
  sendTestReport,
  geocode,
  reverseGeocodeController,
} = require('../../controllers/organization.controller');
const { protect } = require('../../middlewares/auth');
const { requireRole, requireOrgFeatureTogglePermission } = require('../../middlewares/role');
const { body } = require('express-validator');

const router = Router();

router.get('/lookup/:slug', param('slug').trim().notEmpty(), lookupBySlug);

router.use(protect);

router.get('/current', getCurrentOrgDefaults);
router.get('/timezones', listTimezones);
router.get('/geocode', geocode);
router.get('/reverse-geocode', reverseGeocodeController);

router.patch(
  '/:orgId/feature-toggles',
  param('orgId').isMongoId(),
  requireOrgFeatureTogglePermission,
  updateFeatureToggles
);

router.use(requireRole('super_admin'));

router.get('/', listAll);
router.post(
  '/',
  body('name').trim().notEmpty(),
  body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/i),
  create
);
router.patch('/:orgId', param('orgId').isMongoId(), update);
router.delete('/:orgId', param('orgId').isMongoId(), remove);
router.get('/:orgId/admins', param('orgId').isMongoId(), listAdminsInOrg);
router.post(
  '/:orgId/admins',
  param('orgId').isMongoId(),
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  createAdminInOrg
);
router.patch(
  '/:orgId/admins/:adminId',
  param('orgId').isMongoId(),
  param('adminId').isMongoId(),
  updateAdminInOrg
);
router.post(
  '/:orgId/admins/:adminId/reset-2fa',
  param('orgId').isMongoId(),
  param('adminId').isMongoId(),
  resetAdminTwoFactor
);
router.post('/:orgId/send-test-report', param('orgId').isMongoId(), sendTestReport);

module.exports = router;