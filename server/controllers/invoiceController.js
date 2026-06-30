const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const Order = require('../models/Order');

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
exports.getInvoices = async (req, res, next) => {
    try {
        const { paymentStatus, isApproved, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        if (isApproved !== undefined) {
            filter.isApproved = isApproved === 'true';
            if (isApproved === 'false') {
                filter.isGenerated = true;
            }
        } else {
            filter.isApproved = true;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Invoice.countDocuments(filter);
        const invoices = await Invoice.find(filter)
            .populate('order', 'orderId status')
            .populate('customer', 'customerId name phone customerType')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: invoices.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            data: invoices,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single invoice with payments + business details
// @route   GET /api/invoices/:id
// @access  Private
exports.getInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate({
                path: 'order',
                populate: [
                    { path: 'customer' },
                    { path: 'items' },
                ],
            })
            .populate('customer');

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const payments = await Payment.find({ invoice: invoice._id })
            .populate('processedBy', 'name')
            .sort('-createdAt');

        // Fetch business settings for invoice display
        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        res.status(200).json({
            success: true,
            data: {
                ...invoice.toObject(),
                payments,
                business: {
                    name: settings.businessName,
                    phone: settings.businessPhone,
                    email: settings.businessEmail,
                    address: settings.businessAddress,
                    taxNumberLabel: settings.taxNumberLabel,
                    taxNumber: settings.taxNumber,
                    currency: settings.currency,
                    taxRate: settings.taxRate,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update invoice (edit items, discount, tax, service charge)
// @route   PUT /api/invoices/:id
// @access  Private (all authenticated users with invoice access)
exports.updateInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        // Check finalized guard — only admin can edit finalized invoices
        if (invoice.isFinalized && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'This invoice is finalized. Only Admin can edit finalized invoices.',
            });
        }

        const order = await Order.findById(invoice.order);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Associated order not found' });
        }

        const {
            items,
            discountPercent = order.discountPercent || 0,
            taxPercent = order.taxPercent || 0,
            serviceCharge = order.serviceCharge || 0,
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one item is required' });
        }

        // Validate and process items
        const processedItems = [];
        for (const item of items) {
            const quantity = Number(item.quantity);
            if (!quantity || quantity <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Item "${item.itemName || item.serviceName}" must have quantity greater than zero`,
                });
            }

            const pricePerUnit = Number(item.pricePerUnit);
            if (Number.isNaN(pricePerUnit) || pricePerUnit < 0) {
                return res.status(400).json({
                    success: false,
                    message: `Item "${item.itemName || item.serviceName}" must have a valid price`,
                });
            }

            processedItems.push({
                ...item,
                quantity,
                pricePerUnit,
                subtotal: quantity * pricePerUnit,
            });
        }

        // Calculate totals — exclude manual items from billing
        const billableItems = processedItems.filter(item => item.serviceType !== 'manual');
        const subtotal = billableItems.reduce((sum, item) => sum + item.subtotal, 0);
        const taxAmount = (subtotal * Number(taxPercent)) / 100;
        const discountAmount = (subtotal * Number(discountPercent)) / 100;
        const totalAmount = subtotal + taxAmount - discountAmount + Number(serviceCharge);

        // Preserve existing paid amount
        const paidAmount = invoice.paidAmount || 0;
        const balanceDue = totalAmount - paidAmount;

        // Determine payment status
        let paymentStatus = 'unpaid';
        if (paidAmount >= totalAmount && totalAmount > 0) {
            paymentStatus = 'paid';
        } else if (paidAmount > 0) {
            paymentStatus = 'partial';
        }

        // Update Order
        order.items = processedItems;
        order.subtotal = subtotal;
        order.taxPercent = Number(taxPercent);
        order.taxAmount = taxAmount;
        order.discountPercent = Number(discountPercent);
        order.discountAmount = discountAmount;
        order.serviceCharge = Number(serviceCharge);
        order.totalAmount = totalAmount;
        await order.save();

        // Update Invoice
        invoice.subtotal = subtotal;
        invoice.taxAmount = taxAmount;
        invoice.discountAmount = discountAmount;
        invoice.serviceCharge = Number(serviceCharge);
        invoice.totalAmount = totalAmount;
        invoice.balanceDue = balanceDue;
        invoice.paymentStatus = paymentStatus;
        await invoice.save();

        // Re-fetch with full population for response
        const updatedInvoice = await Invoice.findById(invoice._id)
            .populate({
                path: 'order',
                populate: [
                    { path: 'customer' },
                    { path: 'items' },
                ],
            })
            .populate('customer');

        const payments = await Payment.find({ invoice: invoice._id })
            .populate('processedBy', 'name')
            .sort('-createdAt');

        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        res.status(200).json({
            success: true,
            message: 'Invoice updated successfully',
            data: {
                ...updatedInvoice.toObject(),
                payments,
                business: {
                    name: settings.businessName,
                    phone: settings.businessPhone,
                    email: settings.businessEmail,
                    address: settings.businessAddress,
                    taxNumberLabel: settings.taxNumberLabel,
                    taxNumber: settings.taxNumber,
                    currency: settings.currency,
                    taxRate: settings.taxRate,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Approve invoice
// @route   PUT /api/invoices/:id/approve
// @access  Private (Admin, Manager, Cashier)
exports.approveInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id).populate('order');
        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }
        
        invoice.isApproved = true;
        invoice.isGenerated = true;
        await invoice.save();

        // Create notification for customer portal/APK
        try {
            const Notification = require('../models/Notification');
            await Notification.create({
                recipient: invoice.customer,
                recipientModel: 'Customer',
                type: 'invoice-approved',
                title: 'Invoice Approved',
                message: `Your invoice ${invoice.invoiceId} is now approved and ready for payment. Total amount: $${invoice.totalAmount.toFixed(2)}.`,
                relatedOrder: invoice.order?._id,
                relatedCustomer: invoice.customer,
            });
        } catch (err) {
            console.error('Error creating customer notification for invoice approval:', err);
        }

        res.status(200).json({
            success: true,
            message: 'Invoice approved successfully',
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
};
