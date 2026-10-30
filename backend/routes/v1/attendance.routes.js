const { Router } = require('express');
const { body, param } = require('express-validator');
const {
  adminPunchIn,
  adminPunchOut,
  listAttendance,
  attendanceCounts,
  correctAttendance,
  shiftInfo,
  todayForEmployee,
} = require('../../controllers/attendance.controller');
const { protect } = require('../../middlewares/auth');
const requireActiveOrg = require('../../middlewares/requireActiveOrg');
const { uploadImage } = require('../../middlewares/upload');
const { uploadLocalImageToCloudinary } = require('../../services/upload.service');

function optionalSelfie(req, res, next) {
  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) {
    return uploadImage.single('selfie')(req, res, async (err) => {
      if (err) return next(err);
      if (req.file) {
        try {
          const { url, publicId } = await uploadLocalImageToCloudinary(req.file.path);
          req.body.selfiePath = url;
          req.body.selfiePublicId = publicId;
        } catch (uploadErr) {
          return next(uploadErr);
        }
      }
      next();
    });
  }
  next();
}

const router = Router();

router.use(protect);
router.use(requireActiveOrg);

router.get('/', listAttendance);
router.get('/counts', attendanceCounts);
router.get('/today/:employeeId', param('employeeId').isMongoId(), todayForEmployee);
router.post(
  '/punch-in',
  optionalSelfie,
  body('employeeId').isMongoId(),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  adminPunchIn
);
router.post(
  '/punch-out',
  body('employeeId').isMongoId(),
  body('lat').optional().isFloat(),
  body('lng').optional().isFloat(),
  adminPunchOut
);
router.get('/:id/shift', param('id').isMongoId(), shiftInfo);
router.patch('/:id/correct', param('id').isMongoId(), correctAttendance);

module.exports = router;