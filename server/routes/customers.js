const express = require('express');
const router = express.Router();
const {
    getCustomers,
    getCustomer,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    bulkImportCustomers,
} = require('../controllers/customerController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.post('/bulk-import', authorize('admin', 'manager'), bulkImportCustomers);

router.route('/').get(getCustomers).post(createCustomer);
router
    .route('/:id')
    .get(getCustomer)
    .put(updateCustomer)
    .delete(authorize('admin'), deleteCustomer);

module.exports = router;
