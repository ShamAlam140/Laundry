const express = require('express');
const router = express.Router();
const { createPayment, getPayments } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(getPayments)
    .post(authorize('admin', 'manager', 'cashier'), createPayment);

module.exports = router;
