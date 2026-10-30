const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  list,
  stats,
  nextId,
  getOne,
  summary,
  create,
  update,
  remove,
  registrationLink,
} = require('../../controllers/employee.controller');
const { protect } = require('../../middlewares/auth');
const requireActiveOrg = require('../../middlewares/requireActiveOrg');
const { uploadImage } = require('../../middlewares/upload');

const router = Router();

const emailValidator = body('email').optional({ values: 'falsy' }).isEmail();
const breakTimingValidators = ['morning', 'lunch', 'evening'].map((slot) =>
  body(`breakTimings.${slot}.start`)
    .optional({ values: 'falsy' })
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage(`${slot.charAt(0).toUpperCase() + slot.slice(1)} break time must be HH:MM`)
);

router.use(protect);
router.use(requireActiveOrg);

router.get('/', list);
router.get('/stats', stats);
router.get('/next-id', nextId);
router.get(
  '/:id/registration-link',
  param('id').isMongoId(),
  registrationLink
);
router.post(
  '/:id/profile-photo',
  param('id').isMongoId(),
  uploadImage.single('photo'),
  async (req, res, next) => {
    try {
      const Employee = require('../../models/employee.model');
      if (!req.file) {
        res.status(400);
        throw new Error('No file');
      }
      const rel = `/uploads/${req.file.filename}`;
      const doc = await Employee.findByIdAndUpdate(
        req.params.id,
        { profilePhoto: rel },
        { new: true }
      );
      if (!doc) {
        res.status(404);
        throw new Error('Not found');
      }
      res.json({ success: true, data: doc });
    } catch (e) {
      next(e);
    }
  }
);
router.get('/:id/summary', param('id').isMongoId(), summary);
router.get('/:id', param('id').isMongoId(), getOne);
router.post(
  '/',
  body('name').trim().notEmpty(),
  emailValidator,
  ...breakTimingValidators,
  create
);
router.patch(
  '/:id',
  param('id').isMongoId(),
  emailValidator,
  ...breakTimingValidators,
  update
);
router.delete('/:id', param('id').isMongoId(), remove);

module.exports = router;