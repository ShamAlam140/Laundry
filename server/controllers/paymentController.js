const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Customer = require('../models/Customer');

// @desc    Record payment
// @route   POST /api/payments
// @access  Private (Cashier, Admin, Manager)
exports.createPayment = async (req, res, next) => {
    try {
        const { invoice: invoiceId, paymentMethod, amount, transactionRef, note } = req.body;

        const invoice = await Invoice.findById(invoiceId);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        if (!invoice.isApproved) {
            return res.status(400).json({
                success: false,
                message: 'Invoice must be approved before receiving payments',
            });
        }

        if (amount > invoice.balanceDue) {
            return res.status(400).json({
                success: false,
                message: `Amount (${amount}) exceeds balance due (${invoice.balanceDue})`,
            });
        }

        const payment = await Payment.create({
            invoice: invoiceId,
            paymentMethod,
            amount,
            transactionRef,
            note,
            processedBy: req.user._id,
        });

        // Update invoice
        invoice.paidAmount += amount;
        invoice.balanceDue = invoice.totalAmount - invoice.paidAmount;
        invoice.paymentStatus = invoice.balanceDue <= 0 ? 'paid' : 'partial';

        // Mark as generated since payment is recorded
        invoice.isGenerated = true;

        await invoice.save();

        // If fully paid and corporate check: allow marking as delivered
        // Business rule: Orders cannot be marked "Delivered" without full payment (unless corporate credit)

        const populatedPayment = await Payment.findById(payment._id)
            .populate('processedBy', 'name');

        res.status(201).json({ success: true, data: populatedPayment });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private
exports.getPayments = async (req, res, next) => {
    try {
        const { paymentMethod, startDate, endDate, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (paymentMethod) filter.paymentMethod = paymentMethod;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Payment.countDocuments(filter);
        const payments = await Payment.find(filter)
            .populate({
                path: 'invoice',
                select: 'invoiceId order customer totalAmount',
                populate: [
                    { path: 'order', select: 'orderId' },
                    { path: 'customer', select: 'name phone customerId' },
                ],
            })
            .populate('processedBy', 'name')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: payments.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            data: payments,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete payment
// @route   DELETE /api/payments/:id
// @access  Private (Admin only)
exports.deletePayment = async (req, res, next) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ success: false, message: 'Payment not found' });
        }

        // Find associated invoice
        const invoice = await Invoice.findById(payment.invoice);
        if (invoice) {
            // Deduct payment amount
            invoice.paidAmount = Math.max(0, invoice.paidAmount - payment.amount);
            invoice.balanceDue = invoice.totalAmount - invoice.paidAmount;
            invoice.paymentStatus = invoice.paidAmount <= 0 ? 'unpaid' : (invoice.balanceDue <= 0 ? 'paid' : 'partial');
            await invoice.save();
        }

        await Payment.findByIdAndDelete(req.params.id);

        res.status(200).json({ success: true, message: 'Payment deleted and invoice updated successfully' });
    } catch (error) {
        next(error);
    }
};
