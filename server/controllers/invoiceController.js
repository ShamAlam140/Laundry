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
        const { paymentStatus, isApproved, tab, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (paymentStatus) filter.paymentStatus = paymentStatus;
        
        if (tab === 'cycle') {
            filter.isGenerated = true;
            filter.isCycleInvoice = true;
            // Only show cycle invoices when their time has come (midnight of 7th/15th/30th day)
            filter.cycleReadyDate = { $lte: new Date() }; 
        } else if (tab === 'standard') {
            filter.isApproved = true;
            // Standard tab only shows non-cycle invoices
            filter.$or = [
                { isCycleInvoice: { $exists: false } },
                { isCycleInvoice: false }
            ];
        } else if (isApproved !== undefined) {
            filter.isApproved = isApproved === 'true';
            if (isApproved === 'false') {
                filter.isGenerated = true;
                // Cycle invoices NEVER appear in Pending Approval, they stay in Cycle Invoices
                filter.isCycleInvoice = { $ne: true };
            }
        } else {
            filter.isApproved = true;
            // For generic queries (like Payments modal), fetch standard OR ready cycle invoices
            filter.$or = [
                { isCycleInvoice: { $exists: false } },
                { isCycleInvoice: false },
                { isCycleInvoice: true, cycleReadyDate: { $lte: new Date() } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Invoice.countDocuments(filter);
        const invoices = await Invoice.find(filter)
            .populate('order', 'orderId status')
            .populate('linkedOrders', 'orderId status')
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
            .populate({
                path: 'linkedOrders',
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

        const {
            items,
            discountPercent = 0,
            taxPercent = 0,
            serviceCharge = 0,
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

        // Update Order(s)
        if (invoice.isCycleInvoice && invoice.linkedOrders && invoice.linkedOrders.length > 0) {
            // Group items by originalOrderId
            const itemsByOrder = {};
            processedItems.forEach(item => {
                if (item.originalOrderId) {
                    if (!itemsByOrder[item.originalOrderId]) {
                        itemsByOrder[item.originalOrderId] = [];
                    }
                    itemsByOrder[item.originalOrderId].push(item);
                }
            });

            for (const [orderIdStr, orderItems] of Object.entries(itemsByOrder)) {
                const orderToUpdate = await Order.findById(orderIdStr);
                if (orderToUpdate) {
                    const orderBillable = orderItems.filter(i => i.serviceType !== 'manual');
                    const orderSubtotal = orderBillable.reduce((s, i) => s + i.subtotal, 0);
                    const orderTax = (orderSubtotal * Number(taxPercent)) / 100;
                    const orderDiscount = (orderSubtotal * Number(discountPercent)) / 100;
                    // Distribute service charge proportionally or just set to 0. We'll set to 0 and put serviceCharge on the invoice.
                    const orderTotal = orderSubtotal + orderTax - orderDiscount;
                    
                    orderToUpdate.items = orderItems;
                    orderToUpdate.subtotal = orderSubtotal;
                    orderToUpdate.taxPercent = Number(taxPercent);
                    orderToUpdate.taxAmount = orderTax;
                    orderToUpdate.discountPercent = Number(discountPercent);
                    orderToUpdate.discountAmount = orderDiscount;
                    orderToUpdate.totalAmount = orderTotal;
                    await orderToUpdate.save();
                }
            }
        } else if (invoice.order) {
            const orderToUpdate = await Order.findById(invoice.order);
            if (orderToUpdate) {
                orderToUpdate.items = processedItems;
                orderToUpdate.subtotal = subtotal;
                orderToUpdate.taxPercent = Number(taxPercent);
                orderToUpdate.taxAmount = taxAmount;
                orderToUpdate.discountPercent = Number(discountPercent);
                orderToUpdate.discountAmount = discountAmount;
                orderToUpdate.serviceCharge = Number(serviceCharge);
                orderToUpdate.totalAmount = totalAmount;
                await orderToUpdate.save();
            }
        }

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
            .populate({
                path: 'linkedOrders',
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
            const settings = await Settings.findById('global') || {};
            const currency = settings.currency || '$';

            const Notification = require('../models/Notification');
            await Notification.create({
                recipient: invoice.customer?._id || invoice.customer,
                recipientModel: 'Customer',
                type: 'invoice-approved',
                title: 'Invoice Approved',
                message: `Your invoice ${invoice.invoiceId} is now approved and ready for payment. Total amount: ${currency}${invoice.totalAmount.toFixed(2)}.`,
                relatedOrder: invoice.order?._id,
                relatedCustomer: invoice.customer?._id || invoice.customer,
            });

            // Send Email to Customer
            if (invoice.customer && invoice.customer.email) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const publicUrl = `${frontendUrl}/public/invoice/${invoice._id}`;
                
                let invoiceEmailMessage = settings?.invoiceEmailMessage || 'We are pleased to inform you that your invoice <strong>{invoiceId}</strong> has been approved. The invoice details are summarized below:';
                invoiceEmailMessage = invoiceEmailMessage.replace('{invoiceId}', `<strong>${invoice.invoiceId}</strong>`);

                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="background: linear-gradient(135deg, #1c2a5e, #3b82f6); padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">📄 Invoice Approved</h1>
                            <p style="color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; margin-bottom: 0;">Invoice #${invoice.invoiceId}</p>
                        </div>
                        <div style="padding: 32px;">
                            <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-top: 0; margin-bottom: 12px;">Dear ${invoice.customer.name},</p>
                            <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                                ${invoiceEmailMessage}
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
                                    <span style="color: #1c2a5e; text-align: right; float: right;">${currency}${invoice.totalAmount.toFixed(2)}</span>
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
            .populate({
                path: 'order',
                populate: [
                    { path: 'customer' },
                    { path: 'items' },
                ],
            })
            .populate({
                path: 'linkedOrders',
                populate: [
                    { path: 'customer' },
                    { path: 'items' },
                ],
            })
            .populate('customer');

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        res.status(200).json({
            success: true,
            data: {
                ...invoice.toObject(),
                business: {
                    name: settings.businessName,
                    phone: settings.businessPhone,
                    email: settings.businessEmail,
                    address: settings.businessAddress,
                    taxNumberLabel: settings.taxNumberLabel,
                    taxNumber: settings.taxNumber,
                    currency: settings.currency,
                    taxRate: settings.taxRate,
                    website: settings.website,
                    companyName: settings.companyName,
                    suburb: settings.suburb,
                    state: settings.state,
                    postcode: settings.postcode,
                    bankAccountName: settings.bankAccountName,
                    bankName: settings.bankName,
                    bankBSB: settings.bankBSB,
                    bankAccountNo: settings.bankAccountNo,
                    abn: settings.abn || settings.taxNumber,
                }
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Split a cycle invoice at a given date
// @route   POST /api/invoices/:id/split
// @access  Private (Admin, Manager)
exports.splitCycleInvoice = async (req, res, next) => {
    try {
        const { splitDate } = req.body;

        if (!splitDate) {
            return res.status(400).json({ success: false, message: 'splitDate is required' });
        }

        const invoice = await Invoice.findById(req.params.id)
            .populate({
                path: 'linkedOrders',
                populate: [{ path: 'customer' }, { path: 'items' }],
            })
            .populate('customer');

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        if (!invoice.isCycleInvoice) {
            return res.status(400).json({ success: false, message: 'This is not a cycle invoice' });
        }

        if (invoice.isApproved) {
            return res.status(400).json({ success: false, message: 'Invoice is already approved and cannot be split' });
        }

        if (!invoice.linkedOrders || invoice.linkedOrders.length === 0) {
            return res.status(400).json({ success: false, message: 'No linked orders found in this invoice' });
        }

        // Parse the split date – include orders up to end of this day
        const cutoffDate = new Date(splitDate);
        cutoffDate.setHours(23, 59, 59, 999);

        // Separate orders into two groups
        const payNowOrders = [];
        const carryForwardOrders = [];

        for (const order of invoice.linkedOrders) {
            const orderDate = new Date(order.createdAt);
            if (orderDate <= cutoffDate) {
                payNowOrders.push(order);
            } else {
                carryForwardOrders.push(order);
            }
        }

        if (payNowOrders.length === 0) {
            return res.status(400).json({ success: false, message: 'No orders found on or before the selected date' });
        }

        // If all orders fall within the date range, just approve the full invoice
        if (carryForwardOrders.length === 0) {
            invoice.isApproved = true;
            await invoice.save();

            // Send approval email (reuse existing logic)
            try {
                const settings = await Settings.findById('global') || {};
                const currency = settings.currency || '$';
                const Notification = require('../models/Notification');
                await Notification.create({
                    recipient: invoice.customer?._id || invoice.customer,
                    recipientModel: 'Customer',
                    type: 'invoice-approved',
                    title: 'Invoice Approved',
                    message: `Your invoice ${invoice.invoiceId} is now approved and ready for payment. Total amount: ${currency}${invoice.totalAmount.toFixed(2)}.`,
                    relatedCustomer: invoice.customer?._id || invoice.customer,
                });
            } catch (err) {
                console.error('Error creating notification during split-approve:', err);
            }

            return res.status(200).json({
                success: true,
                message: 'All orders fall within the selected date. Invoice approved as-is.',
                data: { approvedInvoice: invoice, newCycleInvoice: null },
            });
        }

        // ── Calculate totals for Pay Now group ──
        let payNowSubtotal = 0;
        let payNowTax = 0;
        let payNowDiscount = 0;
        let payNowServiceCharge = 0;
        let payNowTotal = 0;

        for (const order of payNowOrders) {
            payNowSubtotal += order.subtotal || 0;
            payNowTax += order.taxAmount || 0;
            payNowDiscount += order.discountAmount || 0;
            payNowServiceCharge += order.serviceCharge || 0;
            payNowTotal += order.totalAmount || 0;
        }

        // ── Calculate totals for Carry Forward group ──
        let carrySubtotal = 0;
        let carryTax = 0;
        let carryDiscount = 0;
        let carryServiceCharge = 0;
        let carryTotal = 0;

        for (const order of carryForwardOrders) {
            carrySubtotal += order.subtotal || 0;
            carryTax += order.taxAmount || 0;
            carryDiscount += order.discountAmount || 0;
            carryServiceCharge += order.serviceCharge || 0;
            carryTotal += order.totalAmount || 0;
        }

        // ── Update the ORIGINAL invoice (Pay Now) ──
        invoice.linkedOrders = payNowOrders.map(o => o._id);
        invoice.subtotal = payNowSubtotal;
        invoice.taxAmount = payNowTax;
        invoice.discountAmount = payNowDiscount;
        invoice.serviceCharge = payNowServiceCharge;
        invoice.totalAmount = payNowTotal;
        invoice.balanceDue = payNowTotal - (invoice.paidAmount || 0);
        invoice.isApproved = true; // Auto-approve so payment can be taken immediately
        await invoice.save();

        // ── Create NEW cycle invoice for Carry Forward orders ──
        const Customer = require('../models/Customer');
        const customer = await Customer.findById(invoice.customer._id || invoice.customer);
        const creditDays = customer?.creditDays || 7;
        const moment = require('moment-timezone');
        const timezone = 'Australia/Sydney';

        let newCycleReadyDate = new Date();
        const m = moment();
        if (creditDays === 7) {
            let dayOfWeek = m.isoWeekday();
            if (dayOfWeek !== 7) m.isoWeekday(7);
            newCycleReadyDate = m.endOf('day').toDate();
        } else if (creditDays === 15) {
            if (m.date() <= 15) {
                m.date(15);
            } else {
                m.endOf('month');
            }
            newCycleReadyDate = m.endOf('day').toDate();
        } else if (creditDays === 30) {
            newCycleReadyDate = m.endOf('month').endOf('day').toDate();
        } else if (creditDays > 1) {
            newCycleReadyDate = m.add(creditDays, 'days').endOf('day').toDate();
        }

        const newDueDate = new Date(cutoffDate);
        newDueDate.setDate(newDueDate.getDate() + 1 + creditDays);

        const newCycleInvoice = await Invoice.create({
            customer: invoice.customer._id || invoice.customer,
            linkedOrders: carryForwardOrders.map(o => o._id),
            subtotal: carrySubtotal,
            taxAmount: carryTax,
            discountAmount: carryDiscount,
            serviceCharge: carryServiceCharge,
            totalAmount: carryTotal,
            paidAmount: 0,
            balanceDue: carryTotal,
            paymentStatus: 'unpaid',
            isApproved: false,
            isGenerated: true,
            isCycleInvoice: true,
            cycleReadyDate: newCycleReadyDate,
            dueDate: newDueDate,
            terms: `NET ${creditDays}`,
            createdBy: req.user._id,
        });

        // Send approval notification for the original invoice
        try {
            const settings = await Settings.findById('global') || {};
            const currency = settings.currency || '$';
            const Notification = require('../models/Notification');
            await Notification.create({
                recipient: invoice.customer?._id || invoice.customer,
                recipientModel: 'Customer',
                type: 'invoice-approved',
                title: 'Partial Invoice Approved',
                message: `Your invoice ${invoice.invoiceId} has been partially approved for ${currency}${payNowTotal.toFixed(2)}. Remaining orders have been moved to a new cycle invoice ${newCycleInvoice.invoiceId}.`,
                relatedCustomer: invoice.customer?._id || invoice.customer,
            });

            // Send email
            if (customer && customer.email) {
                const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
                const publicUrl = `${frontendUrl}/public/invoice/${invoice._id}`;
                const emailHtml = `
                    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, #1c2a5e, #3b82f6); padding: 32px; text-align: center;">
                            <h1 style="color: white; margin: 0; font-size: 24px;">📄 Partial Invoice Approved</h1>
                            <p style="color: rgba(255,255,255,0.9); margin-top: 8px; font-size: 14px; margin-bottom: 0;">Invoice #${invoice.invoiceId}</p>
                        </div>
                        <div style="padding: 32px;">
                            <p style="color: #0f172a; font-size: 16px; font-weight: 600; margin-top: 0;">Dear ${customer.name},</p>
                            <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                                Your cycle invoice has been split. Invoice <strong>${invoice.invoiceId}</strong> for <strong>${currency}${payNowTotal.toFixed(2)}</strong> is now approved and ready for payment. 
                                The remaining balance of <strong>${currency}${carryTotal.toFixed(2)}</strong> has been moved to a new cycle invoice <strong>${newCycleInvoice.invoiceId}</strong>.
                            </p>
                            <div style="text-align: center; margin: 32px 0;">
                                <a href="${publicUrl}" style="background: linear-gradient(135deg, #1c2a5e, #3b82f6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 14px; display: inline-block;">
                                    View & Download Invoice
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                sendEmail({
                    email: customer.email,
                    subject: `Partial Invoice Approved #${invoice.invoiceId} - Peninsula Laundries`,
                    html: emailHtml,
                }).catch(err => {
                    console.error('❌ Failed to send split invoice email:', err.message);
                });
            }
        } catch (err) {
            console.error('Error sending split notification:', err);
        }

        res.status(200).json({
            success: true,
            message: `Invoice split successfully. ${payNowOrders.length} orders approved for payment. ${carryForwardOrders.length} orders moved to new cycle invoice ${newCycleInvoice.invoiceId}.`,
            data: {
                approvedInvoice: invoice,
                newCycleInvoice,
            },
        });
    } catch (error) {
        next(error);
    }
};
