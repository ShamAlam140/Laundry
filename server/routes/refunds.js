const express = require('express');
const router = express.Router();
const {
    processFullRefund,
    processPartialRefund,
    getRefunds,
    getRefundById,
    getRefundsByOrder,
    getRefundRecommendations,
    getRefundAnalytics,
    recordDamageDetails,
} = require('../controllers/refundController');
const { protect, authorize } = require('../middleware/auth');

// Apply authentication to all routes
router.use(protect);

// Refund processing routes (Admin, Manager only)
router.post('/full', authorize('admin', 'manager'), processFullRefund);
router.post('/partial', authorize('admin', 'manager'), processPartialRefund);
router.post('/damage', authorize('admin', 'manager'), recordDamageDetails);

// Refund listing and retrieval
router.get('/', authorize('admin', 'manager'), getRefunds);
router.get('/order/:orderId', getRefundsByOrder);
router.get('/recommendations', authorize('admin', 'manager'), getRefundRecommendations);
router.get('/reports/analytics', authorize('admin', 'manager'), getRefundAnalytics);
router.get('/:id', getRefundById);

module.exports = router;
