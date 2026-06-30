const express = require('express');
const router = express.Router();
const {
    createOrder,
    getOrders,
    getOrder,
    updateOrderStatus,
    updateOrder,
    cancelOrder,
    getDashboardStats,
    bulkImportOrders,
    shipOrder,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Stats route must come before /:id
router.get('/stats/dashboard', getDashboardStats);

// Bulk import route
router.post('/bulk-import', authorize('admin', 'manager'), bulkImportOrders);

router.route('/').get(getOrders).post(authorize('admin', 'manager', 'cashier'), createOrder);
router.post('/:id/ship', authorize('admin', 'manager', 'cashier'), shipOrder);
router.route('/:id').get(getOrder).put(updateOrder).delete(cancelOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
