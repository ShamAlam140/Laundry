const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, updateInvoice, approveInvoice, getPublicInvoice } = require('../controllers/invoiceController');
const {
    getMigratedInvoices,
    getMigratedInvoice,
    importMigratedInvoices,
    clearMigratedInvoices
} = require('../controllers/migratedInvoiceController');
const { protect, authorize } = require('../middleware/auth');

// Public route to view invoices (No Authentication Required)
router.get('/public/:id', getPublicInvoice);

router.use(protect);

// Migrated invoice routes (must be registered BEFORE standard :id)
router.route('/migrated')
    .get(getMigratedInvoices)
    .delete(authorize('admin'), clearMigratedInvoices);
router.route('/migrated/import').post(importMigratedInvoices);
router.route('/migrated/:id').get(getMigratedInvoice);

router.route('/').get(getInvoices);
router.route('/:id/approve').put(authorize('admin', 'manager', 'cashier'), approveInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice);

module.exports = router;
