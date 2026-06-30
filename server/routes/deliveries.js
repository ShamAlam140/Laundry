const express = require('express');
const router = express.Router();
const {
    createDelivery,
    getDeliveries,
    getDelivery,
    updateDeliveryStatus,
    confirmDelivery,
    regenerateOtp,
    assignStaff,
    deleteDelivery,
    getTodaySchedule,
} = require('../controllers/deliveryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/today', getTodaySchedule);
router.get('/', getDeliveries);
router.get('/:id', getDelivery);
router.post('/', authorize('admin', 'manager', 'cashier'), createDelivery);
router.patch('/:id/status', updateDeliveryStatus);
router.post('/:id/confirm', confirmDelivery);
router.post('/:id/regenerate-otp', regenerateOtp);
router.patch('/:id/assign', authorize('admin', 'manager'), assignStaff);
router.delete('/:id', authorize('admin'), deleteDelivery);

module.exports = router;

