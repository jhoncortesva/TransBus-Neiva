const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const { getRoutes, getRouteById, createRoute, updateRoute, deleteRoute } = require('../controllers/routeController');

router.get('/', getRoutes);
router.get('/:id', getRouteById);
router.post('/', authMiddleware, requireRole('admin'), createRoute);
router.put('/:id', authMiddleware, requireRole('admin'), updateRoute);
router.delete('/:id', authMiddleware, requireRole('admin'), deleteRoute);

module.exports = router;
