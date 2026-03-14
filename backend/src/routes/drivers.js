const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authMiddleware, requireRole } = require('../middleware/auth');
const {
  createDriver,
  getDrivers,
  getDriver,
  toggleDriverStatus,
} = require('../controllers/driverController');

// Multer config for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/licenses/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'license-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// All routes require admin role
router.use(authMiddleware, requireRole('admin'));

router.post('/', upload.single('license_pdf'), createDriver);
router.get('/', getDrivers);
router.get('/:id', getDriver);
router.patch('/:id/toggle-status', toggleDriverStatus);

module.exports = router;
