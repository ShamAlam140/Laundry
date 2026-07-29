const express = require('express');
const router = express.Router();
const { getInvoices, getInvoice, updateInvoice, approveInvoice, getPublicInvoice, splitCycleInvoice } = require('../controllers/invoiceController');
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
// @route   POST /api/invoices/:id/split
// @desc    Split a cycle invoice into pay-now and carry-forward parts
// @access  Private (Admin/Manager)
router.post('/:id/split', protect, authorize('admin', 'manager'), splitCycleInvoice);

// TEMP SEED ROUTE
router.post('/seed-test-orders', async (req, res) => {
    try {
        const Order = require('../models/Order');
        const Invoice = require('../models/Invoice');
        
        // Target invoice and customer
        const invoiceId = '6a69971c6ec1cdf4d404a0cb'; // Invoice we just saw
        const customerId = '6a57288c2dcd2c87a155d96f';

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

        const dates = [
            new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
            new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
            new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)  // 2 days ago
        ];

        let totalToAdd = 0;
        let taxToAdd = 0;

        for (let i = 0; i < dates.length; i++) {
            const date = dates[i];
            const orderTotal = 150 + i * 50; // Random totals: 150, 200, 250
            const tax = orderTotal * 0.1;
            
            const newOrder = await Order.create({
                orderId: `TEST-ORD-00${i + 1}`,
                customer: customerId,
                status: 'shipped',
                subtotal: orderTotal,
                taxAmount: tax,
                totalAmount: orderTotal + tax,
                balanceDue: orderTotal + tax,
                createdAt: date,
                updatedAt: date
            });

            invoice.linkedOrders.push(newOrder._id);
            totalToAdd += orderTotal + tax;
            taxToAdd += tax;
        }

        invoice.subtotal += (totalToAdd - taxToAdd);
        invoice.taxAmount += taxToAdd;
        invoice.totalAmount += totalToAdd;
        invoice.balanceDue += totalToAdd;
        
        await invoice.save();

        res.json({ success: true, message: 'Added 3 past orders to the invoice', invoice });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.route('/:id/approve').put(authorize('admin', 'manager', 'cashier'), approveInvoice);
router.route('/:id').get(getInvoice).put(updateInvoice);

module.exports = router;
