const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const Order = require('../models/Order');
const sendEmail = require('../utils/emailService');

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
        const invoice = await Invoice.findById(req.params.id).populate('order').populate('customer');
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
                recipient: invoice.customer?._id || invoice.customer,
                recipientModel: 'Customer',
                type: 'invoice-approved',
                title: 'Invoice Approved',
                message: `Your invoice ${invoice.invoiceId} is now approved and ready for payment. Total amount: $${invoice.totalAmount.toFixed(2)}.`,
                relatedOrder: invoice.order?._id,
                relatedCustomer: invoice.customer?._id || invoice.customer,
            });

            // Send Email to Customer
            if (invoice.customer && invoice.customer.email) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const publicUrl = `${frontendUrl}/public/invoice/${invoice._id}`;
                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(135deg, #1c2a5e, #3b82f6); padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">📄 Invoice Approved</h1>
                            <p style="color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; margin-bottom: 0;">Invoice #${invoice.invoiceId}</p>
                        </div>
                        <div style="padding: 32px;">
                            <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 12px;">Dear ${invoice.customer.name},</p>
                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                                We are pleased to inform you that your invoice <strong>${invoice.invoiceId}</strong> has been approved. The invoice details are summarized below:
                            </p>
                            
                            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 24px; border: 1px solid #f1f5f9;">
                                <div style="display: block; margin-bottom: 8px; font-size: 14px;">
                                    <span style="color: #64748b;">Invoice ID</span>
                                    <span style="color: #334155; font-weight: 600; text-align: right; float: right;">${invoice.invoiceId}</span>
                                    <div style="clear: both;"></div>
                                </div>
                                <div style="display: block; margin-bottom: 8px; font-size: 14px;">
                                    <span style="color: #64748b;">Due Date</span>
                                    <span style="color: #334155; font-weight: 500; text-align: right; float: right;">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU') : 'Due on receipt'}</span>
                                    <div style="clear: both;"></div>
                                </div>
                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
                                <div style="display: block; font-size: 16px; font-weight: 700;">
                                    <span style="color: #0f172a;">Total Amount</span>
                                    <span style="color: #1c2a5e; text-align: right; float: right;">$${invoice.totalAmount.toFixed(2)}</span>
                                    <div style="clear: both;"></div>
                                </div>
                            </div>

                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${publicUrl}" style="background: linear-gradient(135deg, #1c2a5e, #3b82f6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-block;">
                                    View & Download PDF Invoice
                                </a>
                            </div>
                            
                            <p style="color: #94a3b8; font-size: 12px; line-height: 1.6; margin-top: 0; margin-bottom: 0; text-align: center;">
                                If you have any questions or require support, please feel free to reach out to us.
                            </p>
                        </div>
                    </div>
                `;

                // Fire async email
                sendEmail({
                    email: invoice.customer.email,
                    subject: `Invoice Approved #${invoice.invoiceId} - Peninsula Laundries`,
                    html: emailHtml,
                }).catch(err => {
                    console.error('❌ Failed to send Invoice Approved email:', err.message);
                });
            }
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

// @desc    Get public invoice (no auth required)
// @route   GET /api/invoices/public/:id
// @access  Public
exports.getPublicInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findById(req.params.id)
            .populate('order')
            .populate('customer');

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        res.status(200).json({
            success: true,
            data: invoice,
        });
    } catch (error) {
        next(error);
    }
};
