const express = require('express');
const router = express.Router();
const {
    getSalesReport,
    getOrdersReport,
    getCustomerReport,
    getStaffReport,
} = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/sales', getSalesReport);
router.get('/orders', getOrdersReport);
router.get('/customers', getCustomerReport);
router.get('/staff', getStaffReport);

module.exports = router;
