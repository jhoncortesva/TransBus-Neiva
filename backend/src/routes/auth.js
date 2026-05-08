const express = require('express');
const router = express.Router();
const { login, register, getProfile, changePassword, updatePhoto, savePushSub, removePushSub } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', register);
router.get('/profile', authMiddleware, getProfile);
router.patch('/change-password', authMiddleware, changePassword);
router.patch('/update-photo', authMiddleware, updatePhoto);
router.patch('/push-sub', authMiddleware, savePushSub);
router.delete('/push-sub', authMiddleware, removePushSub);

module.exports = router;
