const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrder,
    updateOrderStatus,
    cancelOrder,
    getDashboardStats,
    bulkImportOrders,
    shipOrder,
    updateOrder,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Stats route must come before /:id
router.get('/stats/dashboard', getDashboardStats);

// Bulk import route
router.post('/bulk-import', authorize('admin', 'manager'), bulkImportOrders);

router.route('/').get(getOrders).post(authorize('admin', 'manager', 'cashier'), createOrder);
router.post('/:id/ship', authorize('admin', 'manager', 'cashier'), shipOrder);
router.route('/:id')
    .get(getOrder)
    .put(authorize('admin', 'manager', 'cashier'), updateOrder)
    .delete(authorize('admin'), cancelOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
