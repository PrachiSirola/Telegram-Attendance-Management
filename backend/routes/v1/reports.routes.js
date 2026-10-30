const { Router } = require('express');
const {
  summaryJson,
  exportExcel,
  exportCsv,
  exportPdf,
} = require('../../controllers/reports.controller');
const { protect } = require('../../middlewares/auth');

const router = Router();
router.use(protect);
router.get('/summary', summaryJson);
router.get('/export/excel', exportExcel);
router.get('/export/csv', exportCsv);
router.get('/export/pdf', exportPdf);

module.exports = router;
