const express = require('express');
const router = express.Router();
const {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
} = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/').get(getCustomers).post(createCustomer);
router
    .route('/:id')
    .get(getCustomer)
    .put(updateCustomer)
    .delete(authorize('admin', 'manager'), deleteCustomer);

module.exports = router;
