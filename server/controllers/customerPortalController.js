const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');
const Service = require('../models/Service');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const { createNotification } = require('./notificationController');

// @desc    Get customer's orders
// @route   GET /api/customer-portal/orders
// @access  Private (Customer)
exports.getMyOrders = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = { customer: req.customer._id };
        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Order.countDocuments(filter);
        const orders = await Order.find(filter)
            .select('orderId status totalAmount items createdAt deliveryDate')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        res.status(200).json({
            success: true,
            count: orders.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            data: orders,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single order detail
// @route   GET /api/customer-portal/orders/:id
// @access  Private (Customer)
exports.getMyOrder = async (req, res, next) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            customer: req.customer._id,
        })
            .populate('statusHistory.updatedBy', 'name')
            .populate('assignedStaff', 'name');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Get associated invoice
        const invoice = await Invoice.findOne({ order: order._id });

        // Get deliveries
        const deliveries = await Delivery.find({ order: order._id })
            .select('deliveryId type status scheduledDate scheduledTime completedAt')
            .sort('-scheduledDate');

        res.status(200).json({
            success: true,
            data: { ...order.toObject(), invoice, deliveries },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer's invoices
// @route   GET /api/customer-portal/invoices
// @access  Private (Customer)
exports.getMyInvoices = async (req, res, next) => {
    try {
        const { paymentStatus, page = 1, limit = 20 } = req.query;
        const filter = { customer: req.customer._id, isApproved: true };
        if (paymentStatus) filter.paymentStatus = paymentStatus;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Invoice.countDocuments(filter);
        const invoices = await Invoice.find(filter)
            .populate({
                path: 'order',
                select: 'orderId status items totalAmount deliveryDate'
            })
            .populate('customer', 'customerId name phone email address customerType')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        const data = invoices.map(inv => {
            const obj = inv.toObject();
            const creditDays = req.customer.creditDays || 0;
            if (!obj.terms) {
                obj.terms = creditDays > 0 ? `NET ${creditDays}` : 'Due on Receipt';
            }
            if (!obj.dueDate) {
                const due = new Date(inv.createdAt);
                due.setDate(due.getDate() + creditDays);
                obj.dueDate = due;
            }
            obj.business = {
                name: settings.businessName,
                companyName: settings.businessName,
                phone: settings.businessPhone,
                email: settings.businessEmail,
                address: settings.businessAddress,
                taxNumberLabel: settings.taxNumberLabel,
                taxNumber: settings.taxNumber,
                abn: settings.taxNumber,
                currency: settings.currency,
            };
            return obj;
        });

        res.status(200).json({
            success: true,
            count: invoices.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            data,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single invoice detail
// @route   GET /api/customer-portal/invoices/:id
// @access  Private (Customer)
exports.getMyInvoice = async (req, res, next) => {
    try {
        const invoice = await Invoice.findOne({
            _id: req.params.id,
            customer: req.customer._id,
            isApproved: true,
        }).populate({
            path: 'order',
            select: 'orderId status items totalAmount deliveryDate',
        }).populate('customer', 'customerId name phone email address customerType');

        if (!invoice) {
            return res.status(404).json({ success: false, message: 'Invoice not found' });
        }

        const payments = await Payment.find({ invoice: invoice._id }).sort('-createdAt');

        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        const invObj = invoice.toObject();
        const creditDays = invoice.customer?.creditDays || 0;
        if (!invObj.terms) {
            invObj.terms = creditDays > 0 ? `NET ${creditDays}` : 'Due on Receipt';
        }
        if (!invObj.dueDate) {
            const due = new Date(invoice.createdAt);
            due.setDate(due.getDate() + creditDays);
            invObj.dueDate = due;
        }

        res.status(200).json({
            success: true,
            data: {
                ...invObj,
                payments,
                business: {
                    name: settings.businessName,
                    companyName: settings.businessName,
                    phone: settings.businessPhone,
                    email: settings.businessEmail,
                    address: settings.businessAddress,
                    taxNumberLabel: settings.taxNumberLabel,
                    taxNumber: settings.taxNumber,
                    abn: settings.taxNumber,
                    currency: settings.currency,
                }
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer dashboard summary
// @route   GET /api/customer-portal/summary
// @access  Private (Customer)
exports.getSummary = async (req, res, next) => {
    try {
        const customerId = req.customer._id;

        const [totalOrders, activeOrders, completedOrders, totalInvoices, unreadNotifications] = await Promise.all([
            Order.countDocuments({ customer: customerId }),
            Order.countDocuments({
                customer: customerId,
                status: { $nin: ['packed', 'cancelled'] },
            }),
            Order.countDocuments({ customer: customerId, status: 'packed' }),
            Invoice.countDocuments({ customer: customerId, isApproved: true }),
            Notification.countDocuments({ recipient: customerId, recipientModel: 'Customer', isRead: false }),
        ]);

        // Unpaid balance
        const unpaidAgg = await Invoice.aggregate([
            { $match: { customer: customerId, isApproved: true, paymentStatus: { $ne: 'paid' } } },
            { $group: { _id: null, total: { $sum: '$balanceDue' } } },
        ]);

        // Recent orders
        const recentOrders = await Order.find({ customer: customerId })
            .select('orderId status totalAmount createdAt')
            .sort('-createdAt')
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                totalOrders,
                activeOrders,
                completedOrders,
                totalInvoices,
                unpaidBalance: unpaidAgg[0]?.total || 0,
                recentOrders,
                unreadNotifications,
            },
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get available services for ordering
// @route   GET /api/customer-portal/services
// @access  Private (Customer)
exports.getServices = async (req, res, next) => {
    try {
        const filter = { isActive: true };

        if (req.customer?.isPremium) {
            filter.isCustomerSpecific = true;
            filter.$or = [
                { customer: req.customer._id },
                { customerId: req.customer.customerId },
                { customerPhone: req.customer.phone },
            ];
        } else {
            filter.isCustomerSpecific = { $ne: true };
        }

        const services = await Service.find(filter).sort('serviceType name');

        res.status(200).json({ success: true, count: services.length, data: services });
    } catch (error) {
        next(error);
    }
};

// @desc    Customer creates an order
// @route   POST /api/customer-portal/orders
// @access  Private (Customer)
exports.createMyOrder = async (req, res, next) => {
    try {
        const { items, specialInstructions } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one item is required' });
        }

        // Validate and build order items
        const orderItems = [];
        for (const item of items) {
            // Handle manual items (no serviceId)
            if (!item.serviceId && item.serviceType === 'manual') {
                // Manual item - use provided data directly
                orderItems.push({
                    service: null,
                    serviceName: item.serviceName || item.itemName,
                    serviceType: 'manual',
                    itemType: item.itemType || 'Clothing',
                    itemName: item.itemName,
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit || 'piece',
                    pricePerUnit: Number(item.pricePerUnit) || 0,
                    subtotal: Number(item.subtotal) || 0,
                });
            } else if (item.serviceId) {
                // Regular service item
                const service = await Service.findById(item.serviceId);
                if (!service) {
                    return res.status(404).json({ success: false, message: `Service not found: ${item.serviceId}` });
                }
                if (!service.isActive) {
                    return res.status(400).json({ success: false, message: `Service is inactive: ${service.name}` });
                }
                if (req.customer.isPremium && !service.isCustomerSpecific) {
                    return res.status(403).json({
                        success: false,
                        message: `Service "${service.name}" is not available for this premium customer`,
                    });
                }

                if (service.isCustomerSpecific) {
                    const belongsToCustomer =
                        String(service.customer || '') === String(req.customer._id) ||
                        service.customerId === req.customer.customerId ||
                        service.customerPhone === req.customer.phone;

                    if (!req.customer.isPremium || !belongsToCustomer) {
                        return res.status(403).json({
                            success: false,
                            message: `Service "${service.name}" is not available for this customer`,
                        });
                    }
                }
                const quantity = Number(item.quantity) || 1;
                const subtotal = service.pricePerUnit * quantity;
                orderItems.push({
                    service: service._id,
                    serviceName: service.name,
                    serviceType: service.serviceType,
                    quantity,
                    unit: service.unit,
                    pricePerUnit: service.pricePerUnit,
                    subtotal,
                });
            } else {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Each item must have either serviceId or be a manual item with serviceType="manual"' 
                });
            }
        }

        // Get tax from settings
        const settings = await Settings.findOne();
        const taxPercent = settings?.taxPercent || 0;

        // Calculate subtotal only from service items (manual items are for tracking only)
        const subtotal = orderItems
            .filter(i => i.serviceType !== 'manual')
            .reduce((sum, i) => sum + i.subtotal, 0);
        const taxAmount = (subtotal * taxPercent) / 100;
        const totalAmount = subtotal + taxAmount;

        const order = await Order.create({
            customer: req.customer._id,
            items: orderItems,
            specialInstructions,
            subtotal,
            taxPercent,
            taxAmount,
            totalAmount,
        });

        // Auto-create invoice
        const isCycleCustomer = req.customer.notificationFrequency && req.customer.notificationFrequency !== 'none';
        await Invoice.create({
            order: order._id,
            customer: req.customer._id,
            subtotal,
            taxAmount,
            totalAmount,
            isApproved: !isCycleCustomer,
            isGenerated: !isCycleCustomer,
        });

        // Notify admins
        createNotification({
            recipientRoles: ['admin', 'manager'],
            type: 'order-created',
            title: 'New Customer Order',
            message: `Order ${order.orderId} placed by ${req.customer.name} — Total: ${totalAmount}`,
            relatedOrder: order._id,
            relatedCustomer: req.customer._id,
        });

        // Notify customer
        try {
            await Notification.create({
                recipient: req.customer._id,
                recipientModel: 'Customer',
                type: 'order-created',
                title: 'Order Placed Successfully',
                message: `Your order ${order.orderId} has been created successfully. Total amount is $${totalAmount.toFixed(2)}.`,
                relatedOrder: order._id,
                relatedCustomer: req.customer._id,
            });
        } catch (err) {
            console.error('Error creating customer order creation notification:', err);
        }

        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'customerId name phone');

        res.status(201).json({ success: true, data: populatedOrder });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer's own notifications
// @route   GET /api/customer-portal/notifications
// @access  Private (Customer)
exports.getMyNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const filter = { recipient: req.customer._id, recipientModel: 'Customer' };
        if (unreadOnly === 'true') filter.isRead = false;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort('-createdAt')
                .skip(skip)
                .limit(parseInt(limit))
                .populate('relatedOrder', 'orderId status')
                .populate('relatedCustomer', 'customerId name'),
            Notification.countDocuments(filter),
            Notification.countDocuments({ recipient: req.customer._id, recipientModel: 'Customer', isRead: false }),
        ]);

        res.status(200).json({
            success: true,
            count: notifications.length,
            total,
            unreadCount,
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark customer notification as read
// @route   PATCH /api/customer-portal/notifications/:id/read
// @access  Private (Customer)
exports.markMyNotificationAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.customer._id, recipientModel: 'Customer' },
            { isRead: true, readAt: new Date() },
            { returnDocument: 'after' }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        res.status(200).json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark all customer notifications as read
// @route   PATCH /api/customer-portal/notifications/read-all
// @access  Private (Customer)
exports.markAllMyNotificationsAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany(
            { recipient: req.customer._id, recipientModel: 'Customer', isRead: false },
            { isRead: true, readAt: new Date() }
        );
        res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer's invoices filtered by their notification frequency
// @route   GET /api/customer-portal/invoices/filtered
// @access  Private (Customer)
exports.getFilteredInvoices = async (req, res, next) => {
    try {
        const customer = req.customer;
        const frequency = customer.notificationFrequency || 'none';
        
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        let startDate = null;
        let endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let frequencyLabel = 'All Cycle';
        
        switch (frequency) {
            case '1_day':
                startDate = startOfToday;
                frequencyLabel = 'Daily Cycle';
                break;
            case '3_days': {
                const date = new Date(startOfToday);
                date.setDate(date.getDate() - 2);
                startDate = date;
                frequencyLabel = '3-Day Cycle';
                break;
            }
            case '5_days': {
                const date = new Date(startOfToday);
                date.setDate(date.getDate() - 4);
                startDate = date;
                frequencyLabel = '5-Day Cycle';
                break;
            }
            case '1_week': {
                const date = new Date(startOfToday);
                const day = date.getDay(); // 0 is Sunday, 1 is Monday, etc.
                const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday
                startDate = new Date(date.setDate(diff));
                
                // End of this week (Sunday 23:59:59)
                const endWeekDate = new Date(startDate);
                endWeekDate.setDate(endWeekDate.getDate() + 6);
                endDate = new Date(endWeekDate.getFullYear(), endWeekDate.getMonth(), endWeekDate.getDate(), 23, 59, 59, 999);
                
                frequencyLabel = 'Weekly Cycle';
                break;
            }
            case '15_days': {
                const date = new Date(startOfToday);
                if (date.getDate() <= 15) {
                    startDate = new Date(date.getFullYear(), date.getMonth(), 1);
                    endDate = new Date(date.getFullYear(), date.getMonth(), 15, 23, 59, 59, 999);
                } else {
                    startDate = new Date(date.getFullYear(), date.getMonth(), 16);
                    endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
                }
                frequencyLabel = '15-Day Cycle';
                break;
            }
            case '1_month': {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                frequencyLabel = 'Monthly Cycle';
                break;
            }
            case 'none':
            default:
                frequencyLabel = 'No Cycle Filter';
                break;
        }
        
        const filter = { customer: customer._id, isApproved: true };
        if (startDate) {
            filter.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }
        
        const invoices = await Invoice.find(filter)
            .populate({
                path: 'order',
                select: 'orderId status items totalAmount deliveryDate'
            })
            .populate('customer', 'customerId name phone email address customerType')
            .sort('-createdAt');

        let settings = await Settings.findById('global');
        if (!settings) {
            settings = await Settings.create({ _id: 'global' });
        }

        const dataInvoices = invoices.map(inv => {
            const obj = inv.toObject();
            const creditDays = req.customer.creditDays || 0;
            if (!obj.terms) {
                obj.terms = creditDays > 0 ? `NET ${creditDays}` : 'Due on Receipt';
            }
            if (!obj.dueDate) {
                const due = new Date(inv.createdAt);
                due.setDate(due.getDate() + creditDays);
                obj.dueDate = due;
            }
            obj.business = {
                name: settings.businessName,
                companyName: settings.businessName,
                phone: settings.businessPhone,
                email: settings.businessEmail,
                address: settings.businessAddress,
                taxNumberLabel: settings.taxNumberLabel,
                taxNumber: settings.taxNumber,
                abn: settings.taxNumber,
                currency: settings.currency,
            };
            return obj;
        });
            
        res.status(200).json({
            success: true,
            data: {
                frequency,
                frequencyLabel,
                startDate: startDate || null,
                endDate: endDate || null,
                invoices: dataInvoices
            }
        });
    } catch (error) {
        next(error);
    }
};
