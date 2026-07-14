const express = require('express');
const router = express.Router();
const { createPayment, getPayments, deletePayment } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
    .route('/')
    .get(getPayments)
    .post(authorize('admin', 'manager', 'cashier'), createPayment);

router.route('/:id').delete(authorize('admin'), deletePayment);

module.exports = router;
